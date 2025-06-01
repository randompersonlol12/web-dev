// main.js -- Refactored, modular, and documented

/**
 * CanvasDesigner App
 * Provides an interactive canvas for adding, editing, and saving elements.
 * Refactored for modularity, clarity, and performance.
 */

// Utility: Cookie management (can easily swap for localStorage if desired)
const Storage = {
  save(key, value) {
    document.cookie = `${key}=${encodeURIComponent(JSON.stringify(value))}; max-age=31536000; path=/`;
  },
  load(key) {
    const cookie = document.cookie.split(';').find(row => row.trim().startsWith(`${key}=`));
    if (!cookie) return null;
    try {
      return JSON.parse(decodeURIComponent(cookie.split('=')[1]));
    } catch {
      return null;
    }
  },
  remove(key) {
    document.cookie = `${key}=; Max-Age=0; path=/`;
  }
};

// Main class
class CanvasDesigner {
  constructor() {
    /** @type {HTMLElement} */
    this.canvas = document.getElementById('canvas');
    this.selectedElement = null;
    this.elementCounter = 0;
    this.isDragging = false;
    this.isResizing = false;
    this.canvasElements = new Map();
    this.currentImageElement = null;

    // For drag/resize
    this.dragStart = { x: 0, y: 0, left: 0, top: 0 };
    this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };

    // Bind event handlers
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadFromStorage();
  }

  setupEventListeners() {
    // Tool buttons
    document.querySelectorAll('.tool-btn[data-type]').forEach(btn =>
      btn.addEventListener('click', () => this.addElement(btn.dataset.type))
    );

    // Deselect on canvas click
    this.canvas.addEventListener('click', e => {
      if (e.target === this.canvas) this.deselectElement();
    });

    // Prevent context menu on canvas
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Delete' && this.selectedElement) this.deleteElement(this.selectedElement);
      if (e.key === 'Escape') this.deselectElement();
      // Arrow keys for moving elements
      if (this.selectedElement && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        this.moveSelectedElement(e.key);
      }
    });

    // Action buttons
    document.getElementById('saveBtn').addEventListener('click', () => this.saveCanvas());
    document.getElementById('loadBtn').addEventListener('click', () => this.loadCanvas());
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (confirm('Are you sure you want to clear the entire canvas?')) this.clearCanvas();
    });

    // File input for images
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
    element.tabIndex = 0;

    // Default properties
    const defaultProps = {
      type,
      x: 50 + (this.elementCounter * 20),
      y: 50 + (this.elementCounter * 20),
      width: type === 'text' ? 200 : 150,
      height: type === 'text' ? 50 : 100,
      color: type === 'text' ? '#000000' : '#667eea',
      backgroundColor: type === 'text' ? '#ffffff' : '#667eea',
      fontSize: 16,
      text: type === 'text'
        ? 'Sample Text'
        : (type === 'rectangle' ? 'Rectangle' : type === 'circle' ? 'Circle' : ''),
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
    element.style.left = props.x + 'px';
    element.style.top = props.y + 'px';
    element.style.width = props.width + 'px';
    element.style.height = props.height + 'px';
    element.setAttribute('tabindex', 0);
    let innerHTML = '';
    switch (props.type) {
      case 'text':
        element.className = 'canvas-element text-element';
        innerHTML = `
          <div style="color: ${props.color}; font-size: ${props.fontSize}px; background: ${props.backgroundColor}; padding: 10px; border-radius: 5px; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
            ${this.escapeHtml(props.text)}
          </div>
          <div class="resize-handle" tabindex="0" aria-label="Resize Element"></div>
        `;
        break;
      case 'rectangle':
        element.className = 'canvas-element shape-element rectangle';
        element.style.backgroundColor = props.backgroundColor;
        innerHTML = `${this.escapeHtml(props.text)}<div class="resize-handle" tabindex="0" aria-label="Resize Element"></div>`;
        break;
      case 'circle':
        element.className = 'canvas-element shape-element circle';
        element.style.backgroundColor = props.backgroundColor;
        innerHTML = `${this.escapeHtml(props.text)}<div class="resize-handle" tabindex="0" aria-label="Resize Element"></div>`;
        break;
      case 'image':
        element.className = 'canvas-element image-element';
        innerHTML = props.imageUrl
          ? `<img src="${props.imageUrl}" alt="Canvas Image" /><div class="resize-handle" tabindex="0" aria-label="Resize Element"></div>`
          : `Click to add image<div class="resize-handle" tabindex="0" aria-label="Resize Element"></div>`;
        break;
      default:
        break;
    }
    element.innerHTML = innerHTML;
  }

  setupElementInteractions(element) {
    // Remove previous listeners
    element.onmousedown = null;
    element.ondblclick = null;
    element.onfocus = () => this.selectElement(element);
    element.onkeydown = e => {
      if (e.key === 'Delete') this.deleteElement(element);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        this.moveSelectedElement(e.key, 10);
        e.preventDefault();
      }
    };

    element.onmousedown = e => {
      // Resize handle
      if (e.target.classList.contains('resize-handle')) {
        this.isResizing = true;
        this.startResize(e, element);
        return;
      }
      // Start drag
      this.selectElement(element);
      this.isDragging = true;
      this.dragStart = {
        x: e.clientX,
        y: e.clientY,
        left: parseInt(element.style.left, 10) || 0,
        top: parseInt(element.style.top, 10) || 0
      };
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
      e.preventDefault();
    };

    element.ondblclick = e => {
      const props = this.canvasElements.get(element.id);
      if (props.type === 'image' && !props.imageUrl) {
        document.getElementById('fileInput').click();
        this.currentImageElement = element;
      }
    };
  }

  onMouseMove(e) {
    if (this.isDragging && this.selectedElement) {
      const element = this.selectedElement;
      const props = this.canvasElements.get(element.id);
      const deltaX = e.clientX - this.dragStart.x;
      const deltaY = e.clientY - this.dragStart.y;
      const newLeft = this.dragStart.left + deltaX;
      const newTop = this.dragStart.top + deltaY;
      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
      props.x = newLeft;
      props.y = newTop;
    }
  }

  onMouseUp() {
    this.isDragging = false;
    this.isResizing = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  startResize(e, element) {
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = parseInt(element.style.width, 10) || 100;
    const startHeight = parseInt(element.style.height, 10) || 100;
    const handleResize = e2 => {
      if (!this.isResizing) return;
      const deltaX = e2.clientX - startX;
      const deltaY = e2.clientY - startY;
      const newWidth = Math.max(50, startWidth + deltaX);
      const newHeight = Math.max(30, startHeight + deltaY);
      element.style.width = `${newWidth}px`;
      element.style.height = `${newHeight}px`;
      const props = this.canvasElements.get(element.id);
      props.width = newWidth;
      props.height = newHeight;
      this.renderElement(element, props);
      this.setupElementInteractions(element);
    };
    document.addEventListener('mousemove', handleResize);
    const stopResize = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
    };
    document.addEventListener('mouseup', stopResize);
  }

  selectElement(element) {
    this.deselectElement();
    this.selectedElement = element;
    element.classList.add('selected');
    element.focus();
    this.updatePropertiesPanel(element);
  }

  deselectElement() {
    if (this.selectedElement) {
      this.selectedElement.classList.remove('selected');
      this.selectedElement = null;
    }
    this.clearPropertiesPanel();
  }

  updatePropertiesPanel(element) {
    const props = this.canvasElements.get(element.id);
    const panel = document.getElementById('propertiesPanel');
    let html = '<h3>Properties</h3>';
    html += `
      <div class="property-group">
        <label>Position X:</label>
        <input type="number" value="${props.x}" data-prop="x" data-id="${element.id}">
      </div>
      <div class="property-group">
        <label>Position Y:</label>
        <input type="number" value="${props.y}" data-prop="y" data-id="${element.id}">
      </div>
      <div class="property-group">
        <label>Width:</label>
        <input type="number" value="${props.width}" data-prop="width" data-id="${element.id}">
      </div>
      <div class="property-group">
        <label>Height:</label>
        <input type="number" value="${props.height}" data-prop="height" data-id="${element.id}">
      </div>
    `;
    if (props.type === 'text') {
      html += `
        <div class="property-group">
          <label>Text:</label>
          <textarea data-prop="text" data-id="${element.id}">${props.text}</textarea>
        </div>
        <div class="property-group">
          <label>Font Size:</label>
          <input type="number" value="${props.fontSize}" data-prop="fontSize" data-id="${element.id}">
        </div>
        <div class="property-group">
          <label>Text Color:</label>
          <input type="color" class="color-picker" value="${props.color}" data-prop="color" data-id="${element.id}">
        </div>
        <div class="property-group">
          <label>Background Color:</label>
          <input type="color" class="color-picker" value="${props.backgroundColor}" data-prop="backgroundColor" data-id="${element.id}">
        </div>
      `;
    } else if (props.type === 'rectangle' || props.type === 'circle') {
      html += `
        <div class="property-group">
          <label>Text:</label>
          <input type="text" value="${props.text}" data-prop="text" data-id="${element.id}">
        </div>
        <div class="property-group">
          <label>Background Color:</label>
          <input type="color" class="color-picker" value="${props.backgroundColor}" data-prop="backgroundColor" data-id="${element.id}">
        </div>
      `;
    } else if (props.type === 'image') {
      html += `
        <div class="property-group">
          <label>Image URL:</label>
          <input type="url" value="${props.imageUrl}" data-prop="imageUrl" data-id="${element.id}">
        </div>
        <div class="property-group">
          <button class="tool-btn" id="uploadBtn">Upload Image</button>
        </div>
      `;
    }
    html += `
      <div class="property-group">
        <button class="action-btn clear-btn" id="deleteBtn">Delete Element</button>
      </div>
    `;
    panel.innerHTML = html;

    // Property change events
    panel.querySelectorAll('input,textarea').forEach(input => {
      input.onchange = () => {
        const prop = input.dataset.prop;
        let value = input.value;
        if (['x', 'y', 'width', 'height', 'fontSize'].includes(prop)) value = parseInt(value, 10);
        this.updateProperty(input.dataset.id, prop, value);
      };
    });

    // Delete button
    const delBtn = panel.querySelector('#deleteBtn');
    if (delBtn) delBtn.onclick = () => this.deleteElement(element);

    // Upload button
    const uploadBtn = panel.querySelector('#uploadBtn');
    if (uploadBtn) uploadBtn.onclick = () => {
      document.getElementById('fileInput').click();
      this.currentImageElement = element;
    };
  }

  clearPropertiesPanel() {
    document.getElementById('propertiesPanel').innerHTML =
      '<h3>Properties</h3><p style="color: #666; text-align: center;">Select an element to edit its properties</p>';
  }

  updateProperty(elementId, property, value) {
    const element = document.getElementById(elementId);
    const props = this.canvasElements.get(elementId);
    props[property] = value;
    this.renderElement(element, props);
    this.setupElementInteractions(element);
  }

  deleteElement(element) {
    if (!element) return;
    if (element === this.selectedElement) this.deselectElement();
    this.canvasElements.delete(element.id);
    element.remove();
    this.showToast('Element deleted!');
  }

  saveCanvas() {
    const canvasState = {
      elements: Array.from(this.canvasElements.entries()),
      counter: this.elementCounter
    };
    Storage.save('canvasData', canvasState);
    this.showToast('Canvas saved successfully!');
  }

  loadCanvas() {
    const data = Storage.load('canvasData');
    if (data) {
      try {
        this.clearCanvas(false);
        this.elementCounter = data.counter || 0;
        data.elements.forEach(([id, props]) => {
          const element = document.createElement('div');
          element.id = id;
          this.renderElement(element, props);
          this.setupElementInteractions(element);
          this.canvasElements.set(id, props);
          this.canvas.appendChild(element);
        });
        this.showToast('Canvas loaded successfully!');
      } catch (error) {
        this.showToast('Error loading canvas data!');
        console.error('Load error:', error);
      }
    } else {
      this.showToast('No saved canvas found!');
    }
  }

  clearCanvas(showToast = true) {
    this.canvas.innerHTML = '';
    this.canvasElements.clear();
    this.elementCounter = 0;
    this.deselectElement();
    if (showToast) this.showToast('Canvas cleared!');
  }

  handleImageUpload(file) {
    if (file && this.currentImageElement) {
      const reader = new FileReader();
      reader.onload = e => {
        const props = this.canvasElements.get(this.currentImageElement.id);
        props.imageUrl = e.target.result;
        this.renderElement(this.currentImageElement, props);
        this.setupElementInteractions(this.currentImageElement);
        this.updatePropertiesPanel(this.currentImageElement);
      };
      reader.readAsDataURL(file);
    }
  }

  loadFromStorage() {
    const data = Storage.load('canvasData');
    if (data) this.loadCanvas();
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  moveSelectedElement(key, step = 5) {
    if (!this.selectedElement) return;
    const props = this.canvasElements.get(this.selectedElement.id);
    switch (key) {
      case 'ArrowUp':
        props.y = Math.max(0, props.y - step);
        break;
      case 'ArrowDown':
        props.y += step;
        break;
      case 'ArrowLeft':
        props.x = Math.max(0, props.x - step);
        break;
      case 'ArrowRight':
        props.x += step;
        break;
    }
    this.selectedElement.style.left = props.x + 'px';
    this.selectedElement.style.top = props.y + 'px';
    this.updatePropertiesPanel(this.selectedElement);
  }

  // Sanitize user input (XSS protection)
  escapeHtml(text) {
    return text.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }
}

// App startup
document.addEventListener('DOMContentLoaded', () => {
  window.app = new CanvasDesigner();
});