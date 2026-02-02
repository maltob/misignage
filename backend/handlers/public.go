package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
)

func GetPublicPlaylist(c echo.Context) error {
	slug := c.Param("slug")
	var playlist models.Playlist

	if err := db.DB.Where("public_slug = ? AND is_public = ?", slug, true).
		Preload("Slides.Slide").
		First(&playlist).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Playlist not found or not public"})
	}

	return c.JSON(http.StatusOK, playlist)
}

func SearchPublicPlaylist(c echo.Context) error {
	slug := c.Param("slug")
	query := c.QueryParam("q")
	var playlist models.Playlist

	if err := db.DB.Where("public_slug = ? AND is_public = ?", slug, true).
		First(&playlist).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Playlist not found or not public"})
	}

	var slides []models.Slide
	likeQuery := "%" + query + "%"

	// Find slides within this playlist only
	db.DB.Joins("JOIN playlist_slides ON playlist_slides.slide_id = slides.id").
		Where("playlist_slides.playlist_id = ?", playlist.ID).
		Where("name LIKE ? OR ocr_content LIKE ?", likeQuery, likeQuery).
		Find(&slides)

	return c.JSON(http.StatusOK, slides)
}
