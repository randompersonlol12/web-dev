class CanvasDesigner {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.selectedElement = null;
    this.elementCounter = 0;
    this.isDragging = false;
    this.isResizing = false;
    this.canvasElements = new Map();
    this.currentImageElement = null;
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadFromStorage();
  }

  setupEventListeners() {
    // Add element buttons
    document.querySelectorAll('.tool-btn[data-type]').forEach(btn => {
      btn.addEventListener('click', () => this.addElement(btn.dataset.type));
    });

    // Canvas click to deselect
    this.canvas.addEventListener('click', e => {
      if (e.target === this.canvas) this.deselectElement();
    });

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Delete' && this.selectedElement) this.deleteElement(this.selectedElement);
      if (e.key === 'Escape') this.deselectElement();
    });

    // Action buttons
    document.getElementById('saveBtn').addEventListener('click', () => this.saveCanvas());
    document.getElementById('loadBtn').addEventListener('click', () => this.loadCanvas());
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (confirm('Are you sure you want to clear the entire canvas?')) this.clearCanvas();
    });

    // File input
    document.getElementById('fileInput').addEventListener('change', e => {
      const file = e.target.files[0];
      this.handleImageUpload(file);
      e.target.value = '';
    });
  }

  addElement(type) {
    this.elementCounter++;
    const elementId = `element_${type}_${this.elementCounter}`;
    const element = document.createElement('div');
    element.id = elementId;
    element.className = `canvas-element ${type}-element`;

    const defaultProps = {
      type,
      x: 50 + (this.elementCounter * 20),
      y: 50 + (this.elementCounter * 20),
      width: type === 'text' ? 200 : 150,
      height: type === 'text' ? 50 : 100,
      color: type === 'text' ? '#000000' : '#667eea',
      backgroundColor: type === 'text' ? '#ffffff' : '#667eea',
      fontSize: 16,
      text: type === 'text' ? 'Sample Text' : (type === 'rectangle' ? 'Rectangle' : type === 'circle' ? 'Circle' : ''),
      imageUrl: ''
    };

    this.canvasElements.set(elementId, defaultProps);
    this.renderElement(element, defaultProps);
    this.setupElementInteractions(element);
    this.canvas.appendChild(element);
    this.selectElement(element);
    this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} added!`);
  }

  renderElement(element, props) {
    // ... (same as your original, can be improved further for modularity)
    // Add helpful comments as needed for clarity
  }

  setupElementInteractions(element) {
    let startX, startY, startLeft, startTop;
    element.onmousedown = e => {
      if (e.target.classList.contains('resize-handle')) {
        this.isResizing = true;
        this.startResize(e, element);
        return;
      }
      this.selectElement(element);
      this.isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(element.style.left);
      startTop = parseInt(element.style.top);
      document.addEventListener('mousemove', this.boundMouseMove);
      document.addEventListener('mouseup', this.boundMouseUp);
      e.preventDefault();
    };
    // ... rest is similar, but make sure to use bound event handlers and remove them on mouseup to prevent leaks!
  }

  onMouseMove(e) {
    if (this.isDragging && this.selectedElement) {
      // ... update position
    }
  }

  onMouseUp() {
    this.isDragging = false;
    this.isResizing = false;
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
  }

  // ...rest of your methods, with added comments and modularity as needed
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new CanvasDesigner();
});