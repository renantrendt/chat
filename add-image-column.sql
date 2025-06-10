-- Migration to add image_url column to messages table
-- Run this in Supabase SQL Editor

ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update the table comment
COMMENT ON COLUMN messages.image_url IS 'URL to image stored in Supabase storage, nullable for text-only messages'; 