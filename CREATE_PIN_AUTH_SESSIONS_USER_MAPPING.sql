-- =====================================================
-- CREATE PIN AUTH SESSIONS TABLE IN user_mapping DATABASE
-- =====================================================
-- This table stores PIN authentication sessions for mobile app login
-- Similar to qr_auth_sessions but for PIN-based authentication
-- =====================================================

USE user_mapping;

-- Create pin_auth_sessions table
CREATE TABLE IF NOT EXISTS `pin_auth_sessions` (
    `id` INT(11) NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    `session_id` VARCHAR(255) NOT NULL COMMENT 'Unique session identifier (UUID)',
    `user_email` VARCHAR(255) NOT NULL COMMENT 'Email of the user who generated the PIN',
    `pin_code` VARCHAR(10) NOT NULL COMMENT '10-digit PIN code',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When PIN was generated',
    `expires_at` DATETIME NULL COMMENT 'PIN expiration time (5 minutes from creation)',
    `used_at` DATETIME NULL COMMENT 'When PIN was successfully used',
    `device_id` VARCHAR(255) NULL COMMENT 'Device ID that used this PIN',
    `status` ENUM('pending', 'used', 'expired', 'revoked') NOT NULL DEFAULT 'pending' COMMENT 'Session status',
    `ip_address` VARCHAR(45) NULL COMMENT 'IP address where PIN was generated',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `session_id` (`session_id`),
    UNIQUE KEY `unique_active_pin` (`user_email`, `pin_code`, `status`),
    INDEX `idx_user_email` (`user_email`),
    INDEX `idx_pin_code` (`pin_code`),
    INDEX `idx_expires_at` (`expires_at`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores PIN authentication sessions for mobile app login';

-- =====================================================
-- Verification Query
-- =====================================================
SELECT 
    TABLE_NAME, 
    TABLE_ROWS, 
    CREATE_TIME,
    TABLE_COMMENT
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'user_mapping' 
AND TABLE_NAME = 'pin_auth_sessions';

SELECT '✅ pin_auth_sessions table created successfully in user_mapping database!' AS status;

