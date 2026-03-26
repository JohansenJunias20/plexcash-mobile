-- MySQL initialization script for PlexCash development
-- This script runs automatically when MySQL container is first created

-- Grant privileges for root user from any host (development only)
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY 'mantab99' WITH GRANT OPTION;

-- Grant privileges for root user from Docker bridge network
GRANT ALL PRIVILEGES ON *.* TO 'root'@'172.%.%.%' IDENTIFIED BY 'mantab99' WITH GRANT OPTION;

-- Reload privilege tables
FLUSH PRIVILEGES;

-- Show granted users
SELECT host, user FROM mysql.user WHERE user='root';

