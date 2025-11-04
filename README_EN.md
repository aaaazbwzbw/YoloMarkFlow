# YoloMarkFlow

<div align="center">

![YoloMarkFlow Logo](build/icons/png/512x512.png)

**Professional Image Annotation Tool - YOLO Training Support**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)](https://github.com/aaaazbwzbw/YoloMarkFlow)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://www.microsoft.com/windows)

[English](./README_EN.md) | [简体中文](./README.md)

</div>

---

## Project Overview

YoloMarkFlow is a professional and user-friendly image annotation tool with a minimalist black-and-white design, providing high-quality data annotation support for AI training. It supports mainstream formats like YOLO/COCO and can be extended with plugins for model training functionality.

**Core Positioning:**
- 🎯 **Annotation-First** - Professional and efficient image annotation tool
- 🤖 **Optional Training** - Extendable via plugins for complete training workflows
- 🔌 **Plugin Architecture** - Modular design for easy extension
- 🎨 **Minimalist UI** - Simple black-and-white style focused on productivity

---

## ✨ Key Features

### 📝 Complete Image Annotation Workspace

**Annotation Features**
- **Bounding Box Annotation** - Click and drag on empty areas to draw boxes
- **Box Editing** - Resize, move, and delete annotations
- **Right-click Menu** - Quick delete and other operations
- **Label Display** - Show class names and confidence
- **Real-time Preview** - Live bounding box display

**Category Management**
- **Create/Edit/Delete Categories** - Full category management
- **Auto Color Assignment** - 24 preset colors
- **Custom Colors** - Manual color selection
- **Drag to Sort** - Reorder categories
- **Statistics** - Real-time annotation counts per category

**Image Management**
- **Import Images** - Select files or folders for batch import
- **Supported Formats** - JPG, JPEG, PNG, BMP, WebP
- **Auto Deduplication** - MD5-based file hash detection
- **Status Filtering** - All/Annotated/Unannotated/Negative
- **Expand/Collapse Mode** - Adjust thumbnail size (50%-200%)
- **Virtual Scrolling** - Smooth loading for 1000+ images
- **Right-click Menu** - Delete images and more

**Canvas Operations**
- **Zoom** - 10% - 500% (mouse wheel or +/- keys)
- **Pan** - Space + left mouse drag
- **Reset View** - Ctrl+0 to restore 100%
- **Fullscreen Mode** - Full-screen workspace

**Keyboard Shortcuts**
- `Enter` - Save annotation
- `Ctrl+Shift+S` - Save as negative sample
- `→` - Next image
- `←` - Previous image
- `Ctrl+→` - Jump to next unannotated
- `Ctrl+←` - Jump to previous unannotated
- `Backspace` / `Delete` - Delete selected annotation
- `+` / `-` - Zoom in/out
- `Ctrl+0` - Reset zoom

**Toolbar**
- **Auto-save** - Automatically save when switching images
- **Model Assist** - Use trained models for auto-detection (optional)
- **Confidence Threshold** - Adjust inference threshold
- **Shortcut Settings** - Customize shortcuts
- **Floating Toolbar** - Draggable toolbar card

### 🗂️ Unified Image Pool Architecture

**Image Pool System**
- **Smart Deduplication** - MD5 file hash automatic duplicate detection
- **Multi-project Reuse** - Same images across multiple projects
- **Reference Counting** - Automatic reference management
- **Efficient Storage** - SQLite database for optimal performance
- **Workspace Configuration** - Custom image pool storage path

**Project Management**
- **Create Project** - Enter name to create new project
- **Switch Project** - Quick switching between projects
- **Delete Project** - Delete record only or include data
- **Statistics** - Real-time image count and annotation progress

### 📊 Dataset Management

**Dataset Creation**
- **Multi-project Selection** - Select categories from multiple projects
- **Category Filtering** - Merge specific categories selectively
- **Statistics Preview** - Display merged statistics
- **Version Management** - Automatic versioning with multi-version support

**Dataset Export**
- **YOLO Format**
  - Train/Val/Test data split
  - Custom split ratios (slider configuration)
  - Auto-generate `data.yaml` configuration file
  - Normalized coordinates
  - Directory structure: images/, labels/, data.yaml
  
- **COCO JSON Format**
  - Standard COCO data structure
  - categories, images, annotations
  - Automatic coordinate conversion
  - Complete metadata support
  
**Dataset Operations**
- **Update Dataset** - Regenerate dataset contents
- **Version Switch** - Switch to historical versions
- **Export History** - View all export records
- **Delete** - Delete current version or all versions

### 🤖 Model Training (Plugin Support Required)

**Supported Models**
- **YOLOv5** - yolov5n/s/m/l/x.pt
- **YOLOv8** - yolov8n/s/m/l/x.pt
- **YOLO11** - yolo11n/s/m/l/x.pt
- **Pretrained Weights** - Use pretrained models
- **From Scratch** - Train without pretrained weights

**Training Configuration**
- **Task Name** - Custom training task name
- **Dataset Selection** - Select created dataset
- **YOLO Version** - Choose model version
- **Model Size** - Five sizes: n/s/m/l/x
- **Pretrained Weights** - Toggle pretrained usage
- **Output Directory** - Custom training output path
- **Epochs** - 10-500 (step: 10)
- **Batch Size** - 1-64 (step: 1)
- **Image Size** - 640/800/1024
- **Data Augmentation** - Mosaic, MixUp, HSV, Flip

**Advanced Configuration**
- **Learning Rate** - 0.0001-0.1
- **Optimizer** - SGD, Adam, AdamW
- **Train/Val Ratio** - Custom split ratio
- **Early Stop** - Automatic training stop
- **Patience** - 5-100 (step: 5)

**Training Monitoring**
- **Real-time Progress** - Current epoch, total epochs, ETA
- **Loss Curves** - Train Loss, Val Loss
- **Evaluation Metrics** - mAP, mAP50, Precision, Recall
- **Hardware Monitoring** - CPU, Memory, GPU usage
- **Training Speed** - images/sec
- **Visualization** - ECharts real-time plotting

**Training Management**
- **Task Queue** - Display all training tasks
- **Task Control** - Start, pause, resume, stop
- **Retrain** - Train again with same configuration
- **Training History** - View all completed tasks
- **Model Export** - Export trained weight files
- **Model Evaluation** - Evaluate model performance
- **Open Directory** - View training output files

### 🔌 Plugin System

**Plugin Management**
- **Import Plugin** - Support ZIP, RAR archives
- **Auto Extract** - Silent extraction to plugin directory
- **Plugin Validation** - Check plugin integrity
- **Plugin Scanning** - Auto-scan available plugins

**Plugin Interface**
- **Training Plugin** - yolo-training-inference
- **Inference Service** - Model inference interface
- **Standardized Interface** - Unified plugin specification

---

## 🛠️ Tech Stack

**Frontend Framework**
- Vue 3.3.4 + Composition API
- Vue Router 4.2.4
- Element Plus 2.4.1
- Arco Design 2.57.0

**Graphics & Visualization**
- Fabric.js 5.3.0 - Canvas annotation drawing
- ECharts 6.0.0 - Training curve visualization

**Desktop Application**
- Electron 26.2.1
- Node.js runtime

**Data Storage**
- SQLite3 5.1.7 - Local database

**Build Tools**
- Vite 4.4.9
- electron-builder 24.6.4

**Virtual Scrolling**
- vue3-virtual-scroll-list
- vue3-virtual-scroller
- vue-virtual-scroll-grid

**Other Dependencies**
- adm-zip 0.5.16 - File extraction

---

## 📦 Installation & Running

### Requirements

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0
- **OS**: Windows 10/11 (recommended)

### Build from Source

```bash
# 1. Clone repository
git clone https://github.com/aaaazbwzbw/YoloMarkFlow.git
cd YoloMarkFlow/Electron+vue

# 2. Install dependencies
npm install

# 3. Run in development mode
npm run dev

# Or run separately
npm run vue-dev  # Start Vue dev server (http://localhost:5173)
npm run electron # Start Electron app
```

### Download Pre-built Version

Visit [GitHub Releases](https://github.com/aaaazbwzbw/YoloMarkFlow/releases) to download the latest installation package.

---

## 🏗️ Building the Application

```bash
# Build Windows installer
npm run electron:build

# Build output at D:/temp-build-output/
```

**Notes:**
- Recommended to build in English-only path to avoid NSIS packaging failures with Chinese paths
- If packaging fails due to Chinese path, modify output directory in `package.json` to English-only path

---

## 📁 Project Structure

```
Electron+vue/
├── electron/                 # Electron main process
│   ├── main.js              # Main process entry, IPC interfaces
│   ├── preload.js           # Preload script
│   ├── pluginManager.js     # Plugin manager
│   ├── trainingController.js # Training controller
│   ├── inferenceService.js  # Inference service
│   └── modelScanner.js      # Model scanner
├── src/                      # Vue app source
│   ├── views/               # Page components
│   │   ├── MainLayout.vue   # Main layout
│   │   ├── Workbench.vue    # Annotation workspace ⭐
│   │   ├── Training.vue     # Model training
│   │   ├── Datasets.vue     # Dataset management
│   │   ├── Welcome.vue      # Welcome page
│   │   ├── ModelHub.vue     # Model hub
│   │   ├── Settings.vue     # Settings
│   │   └── Help.vue         # Help
│   ├── components/          # Common components
│   │   ├── TrainingTaskCard.vue    # Training task card
│   │   ├── TrainingConfigPanel.vue # Training config panel
│   │   ├── TrainingMonitor.vue     # Training monitor
│   │   ├── HardwareMonitor.vue     # Hardware monitor
│   │   ├── Modal.vue        # Modal dialog
│   │   ├── Toast.vue        # Toast notification
│   │   └── Loading.vue      # Loading indicator
│   ├── utils/               # Utility functions
│   │   ├── imagePool.js     # Image pool management ⭐
│   │   ├── datasetManager.js # Dataset management
│   │   ├── trainingManager.js # Training manager
│   │   ├── projectManager.js # Project management
│   │   ├── annotation.js    # Annotation tools
│   │   ├── canvas.js        # Canvas wrapper
│   │   ├── database.js      # Database utilities
│   │   └── exporters/       # Exporters
│   │       ├── BaseExporter.js
│   │       ├── YoloExporter.js
│   │       └── CocoExporter.js
│   ├── router/              # Router configuration
│   └── styles/              # Global styles
├── plugins/                  # Plugin directory
│   └── README.md            # Plugin documentation
├── models/                   # Model files directory
├── build/                    # Build configuration
│   ├── icons/               # App icons
│   └── installer-hooks.nsh  # NSIS script
├── package.json             # Project configuration
└── vite.config.js           # Vite configuration
```

---

## 🚀 Quick Start

### 1. Create Project

1. Launch app, click "New Project" on welcome page
2. Enter project name (e.g., Face Detection Project)
3. Click "Create"

### 2. Import Images

1. Go to annotation workspace
2. Click "Import Images" button on the left
3. Choose import method:
   - **Select Files** - Batch select image files
   - **Select Folder** - Import entire folder
4. System auto-deduplicates and imports

**Supported Formats**: JPG, JPEG, PNG, BMP, WebP

### 3. Add Categories

1. Click "Add" button in category panel
2. Enter category name (e.g., face)
3. Press Enter or click confirm
4. System auto-assigns color

### 4. Start Annotating

1. **Select Category** - Click target category in list
2. **Draw Box** - Click empty area and drag on canvas
3. **Adjust Box** - Drag edges to resize, drag center to move
4. **Save** - Press `Enter` or click "Save Annotation"
5. **Switch Image** - Use `←` `→` keys or click thumbnail

### 5. Export Dataset

1. Go to dataset management page
2. Click "Create Dataset"
3. **Select Projects** - Check projects and categories to include
4. **Set Split** - Configure train/val/test ratios
5. **Choose Format** - YOLO or COCO JSON
6. **Select Path** - Choose export directory
7. Click "Start Export"

### 6. Start Training (Plugin Required)

1. Install training plugin (see below)
2. Go to model training page
3. Click "New Training"
4. **Configure** - Select dataset, model, hyperparameters
5. Click "Start Training"
6. Monitor progress and metrics

---

## 🔌 Plugin Installation

### Training Plugin

1. **Download** - Get training plugin archive (ZIP or RAR)
2. **Import** - Go to Settings, click "Import Plugin"
3. **Select File** - Choose downloaded archive
4. **Auto Install** - System auto-extracts and installs
5. **Restart** - Restart app after installation

### Plugin Directory Structure

```
plugins/
└── yolo-training-inference/
    ├── plugin.json         # Plugin metadata
    ├── yolomarkflow.exe    # Executable file
    ├── yolo11n.pt         # Model files
    └── README.md           # Plugin documentation
```

---

## 🎨 Design Features

### Minimalist Black & White Style

- **Left Menu** - Black background, white text
- **Main Content** - White background, light gray accents
- **Buttons** - Black theme, subtle hover effects
- **Responsive** - Adaptive window sizing

### Performance Optimizations

- **Virtual Scrolling** - Smooth loading for 1000+ images
- **Image Pool Deduplication** - Save storage space
- **Canvas Reuse** - Optimize memory usage
- **Lazy Loading** - On-demand thumbnail loading

### User Experience

- **Keyboard Shortcuts** - Improve annotation efficiency
- **Auto-save** - Prevent data loss
- **Toast Notifications** - Real-time feedback
- **Loading Indicators** - Clear processing status

---

## 📚 Documentation

- 📖 [User Manual](用户手册.md) - Detailed usage instructions
- 📝 [Changelog](CHANGELOG.md) - Version change history
- 🤝 [Contributing](CONTRIBUTING.md) - How to contribute
- 📄 [License](LICENSE) - MIT License

---

## 🤝 Contributing

We welcome contributions of all kinds!

### How to Contribute

1. Fork this project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

Thanks to these excellent open-source projects:

- [Electron](https://www.electronjs.org/) - Cross-platform desktop framework
- [Vue.js](https://vuejs.org/) - Progressive frontend framework
- [Element Plus](https://element-plus.org/) - Vue 3 UI component library
- [Fabric.js](http://fabricjs.com/) - Canvas graphics library
- [ECharts](https://echarts.apache.org/) - Data visualization library
- [Vite](https://vitejs.dev/) - Frontend build tool

---

## 🔗 Links

- [GitHub Repository](https://github.com/aaaazbwzbw/YoloMarkFlow)
- [Issue Tracker](https://github.com/aaaazbwzbw/YoloMarkFlow/issues)
- [Feature Requests](https://github.com/aaaazbwzbw/YoloMarkFlow/issues)

---

<div align="center">

Made with ❤️ by YoloMarkFlow Team

© 2025 YoloMarkFlow. All rights reserved.

</div>
