# Image to OBJ

A lightweight front-end web app that lets you upload a portrait, generate 4 T-pose view renders (front, back, left, right), and create a downloadable OBJ model.

## How to run

Open `index.html` directly in a browser, or serve the folder locally:

```bash
cd image-to-obj
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Features

- Upload an image
- Convert it into a T-pose 3D-style render pipeline
- Generate front, back, left, and right views
- Download the individual PNG views
- Download the generated OBJ model
- Works fully in the browser without a backend

## Notes

This is a browser-based MVP. It creates a stylized T-pose OBJ from your uploaded image using an algorithmic mesh and render pipeline, suitable for quick concept generation and prototype work.
