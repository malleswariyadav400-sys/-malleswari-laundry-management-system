CREATE DATABASE IF NOT EXISTS laundry_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE laundry_management;

CREATE TABLE IF NOT EXISTS customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(100) NULL,
    address VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    price_per_kg DECIMAL(10,2) NOT NULL,
    description VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS laundry_orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    service_id INT NOT NULL,
    clothes_weight DECIMAL(10,2) NOT NULL,
    order_date DATE NOT NULL,
    delivery_date DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('Pending','Processing','Completed') NOT NULL DEFAULT 'Pending',
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id),
    CONSTRAINT fk_orders_service FOREIGN KEY (service_id)
        REFERENCES services(service_id)
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('UPI','Cash','Card') NOT NULL,
    status ENUM('Paid','Pending') NOT NULL DEFAULT 'Pending',
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id)
        REFERENCES laundry_orders(order_id)
);

SHOW TABLES;
