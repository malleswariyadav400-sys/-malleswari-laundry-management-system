# Malleswari Laundry Management System

## Project files
- `public/index.html` — website frontend
- `server.js` — Express backend and API routes
- `database.sql` — MySQL database and table creation
- `.env.example` — environment variable template
- `package.json` — Node.js dependencies and scripts

## Setup (Windows)
1. Extract this ZIP.
2. Open the extracted project folder in VS Code.
3. Open MySQL Workbench and run all statements in `database.sql`.
4. In the project root, copy `.env.example` and rename the copy to `.env`.
5. Edit `.env` and enter your actual MySQL password after `DB_PASSWORD=`.
6. Open the VS Code terminal in the project root and run:
   ```cmd
   npm install
   npm start
   ```
7. Open `http://localhost:3000` in your browser.

Do not open `public/index.html` by double-clicking it. Run the server and open the localhost address.

## Notes
- The app uses MySQL database `laundry_management`.
- API errors return JSON, and the frontend handles empty/invalid JSON responses safely.
- The database account password belongs only in your local `.env` file. Do not share that file publicly.
