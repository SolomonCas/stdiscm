# CSSECDV
 
Castillo, Solomon Nivron
Lim, Aurelius Justin
Manalo, Jaime Luis
CSSECDV - S11

# Prerequisite:
- Already installed MySQL Workbench
- Already installed Node.js

# Specs:
- MySQL Workbench (Version 8.0)
- Node.js (Version 18.15)

# MySQL Workbench Setup:
- Make sure that the local instance connection have these credentials:
- User is root
- Password is 12345
- Hostname is localhost
- Port is 3306
- When logged in, create a database called accounts. There is no need to create a table. 

# Deployment Instruction:
- Install node_modules by entering this command: npm i
- To start the production application, enter the following command: npm run start
       - To start the development application, enter: npm run debug
- To view the application, go to https://localhost:4000
- The application uses a self-signed HTTPS certificate and will prompt a privacy error.  You can proceed to localhost (unsafe), which is usually found when clicking the “Advance” button.
- The application uses the following fixed credentials for the administrator:
       - Email: admin@gmail.com
       - password: adminacc


# When encountering errors on startup from MySQL authentication, like this…

Error creating accounts table: Error: ER_NOT_SUPPORTED_AUTH_MODE: Client does not support authentication protocol requested by server; consider upgrading MySQL client

or this…

Error checking for admin account: Error: ER_NOT_SUPPORTED_AUTH_MODE: Client does not support authentication protocol requested by server; consider upgrading MySQL client

# do these additional steps:
- Open MySQL Workbench
- Go to your local instance
- Select accounts database
- Open a SQL tab and run these commands:
   - ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '12345'; (ensure that your username is root and the password is set to 12345 for the command to work)
   - FLUSH PRIVILEGES;
