import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export async function saveImageFromFile(file: File): Promise<string> {
  ensureUploadDir();

  const ext = path.extname(file.name) || ".jpg";
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 8) || ".jpg";
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  const arrayBuffer = await file.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(arrayBuffer));

  return `/uploads/${filename}`;
}

export function ensureDemoPlaceholder() {
  ensureUploadDir();
  const placeholder = path.join(UPLOAD_DIR, "demo-placeholder.jpg");
  if (!fs.existsSync(placeholder)) {
    const tinyJpeg = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEBAVFRUVDQ8QEBAQEBAQEBAQFRUWFhURFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAAAAgME/8QAHhAAAgICAgMBAAAAAAAAAAAAAQIDBBESITETQVFh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQACAwEAAAAAAAAAAAAAAAAAAQIRITH/2gAMAwEAAhEDEEA/ALpM6ZpWm6fp8VpbwQ28KxxRoMKqjAFA8A//Z",
      "base64",
    );
    fs.writeFileSync(placeholder, tinyJpeg);
  }
}
