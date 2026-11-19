const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

let db;

async function connectDB() {
    db = await mysql.createPool({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "laundry_management",
        waitForConnections: true,
        connectionLimit: 10,
        dateStrings: true
    });
    await db.query("SELECT 1");
    console.log("MySQL connected successfully!");
}

const asyncRoute = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html"))
);

// Dashboard summary
app.get("/api/dashboard", asyncRoute(async (req, res) => {
    const [[customers]] = await db.query("SELECT COUNT(*) AS total FROM customers");
    const [[services]] = await db.query("SELECT COUNT(*) AS total FROM services");
    const [[orders]] = await db.query("SELECT COUNT(*) AS total FROM laundry_orders");
    const [[revenue]] = await db.query(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'Paid'"
    );
    res.json({
        customers: customers.total,
        services: services.total,
        orders: orders.total,
        revenue: revenue.total
    });
}));

// Customers
app.get("/api/customers", asyncRoute(async (req, res) => {
    const [rows] = await db.query(
        "SELECT customer_id, name, phone, email, address FROM customers ORDER BY customer_id DESC"
    );
    res.json(rows);
}));

app.post("/api/customers", asyncRoute(async (req, res) => {
    const { name, phone, email, address } = req.body;
    if (!String(name || "").trim() || !String(phone || "").trim() ||
        !String(address || "").trim()) {
        return res.status(400).json({ error: "Name, phone and address are required." });
    }
    const [result] = await db.query(
        "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)",
        [name.trim(), phone.trim(), email?.trim() || null, address.trim()]
    );
    res.status(201).json({
        message: "Customer added successfully!",
        customer_id: result.insertId
    });
}));

app.delete("/api/customers/:id", asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: "Invalid customer ID." });
    }
    const [result] = await db.query("DELETE FROM customers WHERE customer_id = ?", [id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Customer not found." });
    res.json({ message: "Customer deleted successfully!" });
}));

// Services
app.get("/api/services", asyncRoute(async (req, res) => {
    const [rows] = await db.query(
        "SELECT service_id, service_name, price_per_kg, description FROM services ORDER BY service_id DESC"
    );
    res.json(rows);
}));

app.post("/api/services", asyncRoute(async (req, res) => {
    const { service_name, price_per_kg, description } = req.body;
    const price = Number(price_per_kg);
    if (!String(service_name || "").trim() || !Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ error: "Enter a valid service name and price." });
    }
    const [result] = await db.query(
        "INSERT INTO services (service_name, price_per_kg, description) VALUES (?, ?, ?)",
        [service_name.trim(), price, String(description || "").trim() || null]
    );
    res.status(201).json({
        message: "Service added successfully!",
        service_id: result.insertId
    });
}));

// Orders
app.get("/api/orders", asyncRoute(async (req, res) => {
    const [rows] = await db.query(`
        SELECT o.order_id, o.customer_id, o.service_id,
               c.name AS customer_name, s.service_name,
               o.clothes_weight,
               DATE_FORMAT(o.order_date, '%Y-%m-%d') AS order_date,
               DATE_FORMAT(o.delivery_date, '%Y-%m-%d') AS delivery_date,
               o.total_amount, o.status
        FROM laundry_orders o
        INNER JOIN customers c ON c.customer_id = o.customer_id
        INNER JOIN services s ON s.service_id = o.service_id
        ORDER BY o.order_id DESC
    `);
    res.json(rows);
}));

app.post("/api/orders", asyncRoute(async (req, res) => {
    const {
        customer_id, service_id, clothes_weight,
        order_date, delivery_date, status
    } = req.body;
    const customerId = Number(customer_id);
    const serviceId = Number(service_id);
    const weight = Number(clothes_weight);
    const validStatuses = ["Pending", "Processing", "Completed"];

    if (!Number.isInteger(customerId) || customerId < 1 ||
        !Number.isInteger(serviceId) || serviceId < 1 ||
        !Number.isFinite(weight) || weight <= 0 ||
        !order_date || !delivery_date) {
        return res.status(400).json({ error: "Please enter all valid order details." });
    }
    if (delivery_date < order_date) {
        return res.status(400).json({ error: "Delivery date cannot be before order date." });
    }

    const [services] = await db.query(
        "SELECT price_per_kg FROM services WHERE service_id = ?", [serviceId]
    );
    if (!services.length) return res.status(404).json({ error: "Service not found." });

    const total = (Number(services[0].price_per_kg) * weight).toFixed(2);
    const orderStatus = validStatuses.includes(status) ? status : "Pending";

    const [result] = await db.query(`
        INSERT INTO laundry_orders
        (customer_id, service_id, clothes_weight, order_date, delivery_date, total_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [customerId, serviceId, weight, order_date, delivery_date, total, orderStatus]);

    res.status(201).json({
        message: "Laundry order created successfully!",
        order_id: result.insertId,
        total_amount: total
    });
}));

app.put("/api/orders/:id", asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!Number.isInteger(id) || id < 1 ||
        !["Pending", "Processing", "Completed"].includes(status)) {
        return res.status(400).json({ error: "Invalid order ID or status." });
    }
    const [result] = await db.query(
        "UPDATE laundry_orders SET status = ? WHERE order_id = ?", [status, id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Order not found." });
    res.json({ message: "Order status updated successfully!" });
}));

// Payments
app.get("/api/payments", asyncRoute(async (req, res) => {
    const [rows] = await db.query(`
        SELECT payment_id, order_id, amount,
               DATE_FORMAT(payment_date, '%Y-%m-%d') AS payment_date,
               payment_method, status
        FROM payments
        ORDER BY payment_id DESC
    `);
    res.json(rows);
}));

app.post("/api/payments", asyncRoute(async (req, res) => {
    const { order_id, amount, payment_date, payment_method, status } = req.body;
    const orderId = Number(order_id);
    const paymentAmount = Number(amount);

    if (!Number.isInteger(orderId) || orderId < 1 ||
        !Number.isFinite(paymentAmount) || paymentAmount <= 0 ||
        !payment_date ||
        !["UPI", "Cash", "Card"].includes(payment_method) ||
        !["Paid", "Pending"].includes(status)) {
        return res.status(400).json({ error: "Please enter valid payment details." });
    }

    const [orders] = await db.query(
        "SELECT order_id FROM laundry_orders WHERE order_id = ?", [orderId]
    );
    if (!orders.length) return res.status(404).json({ error: "Order not found." });

    const [result] = await db.query(`
        INSERT INTO payments (order_id, amount, payment_date, payment_method, status)
        VALUES (?, ?, ?, ?, ?)
    `, [orderId, paymentAmount, payment_date, payment_method, status]);

    res.status(201).json({
        message: "Payment recorded successfully!",
        payment_id: result.insertId
    });
}));

// API fallback always returns JSON, preventing empty-response JSON parse errors.
app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
});

// Error handler
app.use((err, req, res, next) => {
    console.error("Server error:", err.message);
    if (res.headersSent) return next(err);

    if (req.originalUrl.startsWith("/api/")) {
        let status = 500;
        let message = "Internal server error.";

        if (err.code === "ER_NO_REFERENCED_ROW_2") {
            status = 400;
            message = "The selected related record does not exist.";
        } else if (err.code === "ER_ROW_IS_REFERENCED_2") {
            status = 409;
            message = "This record is linked to another record and cannot be deleted.";
        } else if (err.code === "ER_DUP_ENTRY") {
            status = 409;
            message = "A record with the same unique value already exists.";
        } else if (err.type === "entity.parse.failed") {
            status = 400;
            message = "Invalid JSON request.";
        }

        return res.status(status).json({ error: message });
    }

    res.status(500).send("Internal server error.");
});

async function startServer() {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log("----------------------------------------");
            console.log("  MALLESWARI LAUNDRY MANAGEMENT SYSTEM");
            console.log("----------------------------------------");
            console.log(`Website: http://localhost:${PORT}`);
            console.log("Server running successfully!");
        });
    } catch (error) {
        console.error("Could not start the application:", error.message);
        console.error("Check MySQL service, database name, and .env credentials.");
        process.exit(1);
    }
}

startServer();
