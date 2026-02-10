# miSignage API Usage Examples

This guide provides `curl` examples for common operations using the miSignage API.

**Authentication:**
All requests should include the `X-API-KEY` header with your API key. Alternatively, you can use `Authorization: Bearer <token>` if using a JWT.

## 1. Upload a New Slide Image

Creates a new slide of type `image`.

```bash
curl -X POST http://signage.example.com/api/slides \
  -H "X-API-KEY: your_api_key_here" \
  -F "name=Marketing Promo 2026" \
  -F "type=image" \
  -F "file=@/path/to/your/image.jpg"
```

**Response:**
```json
{
  "id": 42,
  "name": "Marketing Promo 2026",
  "type": "image",
  "content": "{\"url\":\"/api/uploads/1700000000_image.jpg\"}",
  ...
}
```

## 2. Replace a Slide Image

Updates an existing slide (by ID) with a new image file. This replaces the old image file on the server.

```bash
# Replace image for Slide ID 42
curl -X PUT http://signage.example.com/api/slides/42 \
  -H "X-API-KEY: your_api_key_here" \
  -F "file=@/path/to/updated-image.png"
```

**Response:**
```json
{
  "id": 42,
  "name": "Marketing Promo 2026",
  "content": "{\"url\":\"/api/uploads/1700000000_updated-image.png\"}",
  ...
}
```

## 3. Set Variables on an HTML Slide

Updates the variable values for an HTML template-based slide. This is useful for dynamic content like updating text, prices, or background images programmatically.

```bash
# Update variables for Slide ID 99 (HTML type)
curl -X POST http://signage.example.com/api/slides/99/variables \
  -H "X-API-KEY: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Welcome to our HQ!",
    "backgroundImage": "https://example.com/company-bg.jpg",
    "overlayOpacity": "0.3"
  }'
```

**Response:**
```json
{
  "id": 99,
  "type": "html",
  "content": "{\"html\": \"...\", \"variables\": {\"message\": \"Welcome to our HQ!\", ...}}",
  ...
}
```

## 4. Add a Slide to a Playlist

Adds an existing slide to a playlist, specifying its order and duration.

```bash
# Add Slide ID 42 to Playlist ID 1
curl -X POST http://signage.example.com/api/playlists/1/slides \
  -H "X-API-KEY: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "slide_id": 42,
    "order": 1,
    "duration": 10
  }'
```

**Response:**
```json
{
  "id": 123,
  "playlist_id": 1,
  "slide_id": 42,
  "order": 1,
  "duration": 10,
  ...
}
```

## 5. List Files from Storage

Retrieves a list of all files currently in the storage system (uploads directory). Requires admin privileges.

```bash
curl -X GET http://signage.example.com/api/storage \
  -H "X-API-KEY: your_api_key_here"
```

**Response:**
```json
[
  {
    "name": "1700000000_image.jpg",
    "size": 102400,
    "url": "/api/uploads/1700000000_image.jpg",
    "is_used": true
  },
  ...
]
```

## 6. Run Storage Cleanup

Deletes all files in storage that are not currently referenced by any slide or display. Requires admin privileges.

```bash
curl -X POST http://signage.example.com/api/storage/cleanup \
  -H "X-API-KEY: your_api_key_here"
```

**Response:**
```json
{
  "deleted_count": 5
}
```
