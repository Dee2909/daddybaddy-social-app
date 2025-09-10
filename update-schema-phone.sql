-- Add phone number support to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT '+1';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_country_code ON users(country_code);

-- Update OTPs table to support phone verification
ALTER TABLE otps ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE otps ADD COLUMN IF NOT EXISTS country_code VARCHAR(5);

-- Add new OTP types
ALTER TABLE otps DROP CONSTRAINT IF EXISTS otps_type_check;
ALTER TABLE otps ADD CONSTRAINT otps_type_check CHECK (type IN ('email_verification', 'password_reset', 'phone_verification'));

-- Create index for phone OTP lookups
CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone);
CREATE INDEX IF NOT EXISTS idx_otps_phone_country ON otps(phone, country_code);

-- Update RLS policies to allow phone-based operations
CREATE POLICY "Allow phone OTP creation" ON otps FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow phone OTP verification" ON otps FOR SELECT USING (true);
CREATE POLICY "Allow phone OTP updates" ON otps FOR UPDATE USING (true);
