# 3D Models Directory

Place your 3D models exported from Blender here.

## Supported Formats

- **GLB** (recommended) - Single binary file, easier to deploy
- **GLTF** - May include separate .bin and texture files

## File Naming

Name your files to match the model selector options:
- `gearbox.glb` - For the gearbox model
- `kettle.glb` - For the kettle model

Or update the model selector in `index.html` to match your file names.

## Exporting from Blender

1. Open your model in Blender
2. File → Export → glTF 2.0
3. Select format: **GLB** (recommended) or GLTF
4. Save to this directory with the correct filename

## Component Naming (for Highlighting)

To enable component highlighting during animation:

1. In Blender, select each component/part
2. Name them in the Outliner (right panel)
3. Names should match (or closely match) component names in `gearbox_metadata.json`
4. Example: If metadata has "1st Gear", name it "1st Gear" or "1st_Gear" in Blender

The application will automatically try to match component names for highlighting.

## File Size

- Keep models under 10MB for GitHub Pages
- For larger models, consider optimization or using a CDN
- GitHub has a 100MB file size limit (50MB recommended for GitHub Pages)

## Current Status

This directory is empty. Add your `.glb` or `.gltf` files here to enable 3D model viewing.

