package storage

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type StorageProvider interface {
	Save(filename string, content io.Reader) (string, error)
	Delete(filename string) error
	GetURL(filename string) string
}

type LocalStorage struct {
	UploadDir string
	BaseURL   string
}

func (l *LocalStorage) Save(filename string, content io.Reader) (string, error) {
	if err := os.MkdirAll(l.UploadDir, 0755); err != nil {
		return "", err
	}

	filePath := filepath.Join(l.UploadDir, filename)
	file, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	if _, err := io.Copy(file, content); err != nil {
		return "", err
	}

	return filename, nil
}

func (l *LocalStorage) Delete(filename string) error {
	filePath := filepath.Join(l.UploadDir, filename)
	return os.Remove(filePath)
}

func (l *LocalStorage) GetURL(filename string) string {
	return fmt.Sprintf("%s/%s", l.BaseURL, filename)
}

var Provider StorageProvider

func InitStorage() {
	Provider = &LocalStorage{
		UploadDir: "uploads",
		BaseURL:   "/api/uploads",
	}
}
