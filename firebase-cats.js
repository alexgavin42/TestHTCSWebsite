// Firebase Firestore Dynamic Database Viewer

class DynamicDatabase {
  constructor() {
    this.db = null;
    this.collection = null;
    this.collectionName = null; // Will be set dynamically
    this.availableCollections = [];
    this.initialized = false;
    this.detectedFields = new Set();
    this.unsubscribe = null;
  }

  // Initialize Firebase with your configuration
  initialize() {
    // REPLACE THIS WITH YOUR FIREBASE CONFIGURATION
    // Get your config from: Firebase Console > Project Settings > Your apps > Firebase SDK snippet
    const firebaseConfig = {
      apiKey: "AIzaSyAlrZjaC2pM8D42yMVehmlkQ5t8_F67hYc",
      authDomain: "alexgavintest.firebaseapp.com",
      projectId: "alexgavintest",
      storageBucket: "alexgavintest.firebasestorage.app",
      messagingSenderId: "162685185633",
      appId: "1:162685185633:web:83769f49c45e5557e7c420",
      measurementId: "G-L77S98EBFQ"
    };

    try {
      // Check if Firebase config is still using placeholder values
      if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        this.showStatus('⚠️ Please configure Firebase in firebase-cats.js', 'error');
        this.showConfigInstructions();
        return false;
      }

      // Initialize Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      this.db = firebase.firestore();
      this.initialized = true;

      this.showStatus('✅ Connected to Firestore', 'connected');
      this.loadCollectionsList();
      this.initializeForm();

      return true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      this.showStatus(`❌ Error: ${error.message}`, 'error');
      return false;
    }
  }

  showConfigInstructions() {
    const display = document.getElementById('catsDisplay');
    display.innerHTML = `
      <div class="no-cats-message">
        <h3>🔧 Firebase Configuration Required</h3>
        <p>To use the Database Viewer, please follow these steps:</p>
        <ol style="text-align: left; max-width: 600px; margin: 20px auto; line-height: 1.8;">
          <li>Go to <a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a></li>
          <li>Create a new project or select an existing one</li>
          <li>Enable <strong>Cloud Firestore</strong> in the Build section</li>
          <li>Go to Project Settings > Your apps > Add web app (or select existing app)</li>
          <li>Copy your Firebase configuration</li>
          <li>Open <strong>firebase-cats.js</strong> and replace the placeholder config (lines 17-24)</li>
          <li>Create a metadata document:
            <ul style="margin-top: 5px;">
              <li>Collection: <code>_metadata</code></li>
              <li>Document: <code>collections</code></li>
              <li>Field: <code>list</code> (array) with values like ["cat", "book"]</li>
            </ul>
          </li>
          <li>Your Firestore rules are already configured correctly!</li>
          <li>Refresh this page</li>
        </ol>
      </div>
    `;
  }

  // Load list of collections from metadata document
  loadCollectionsList() {
    this.db.collection('_metadata').doc('collections').get()
      .then((doc) => {
        if (doc.exists) {
          const data = doc.data();
          this.availableCollections = data.list || [];

          if (this.availableCollections.length > 0) {
            this.displayCollectionButtons();
            // Auto-select first collection
            this.switchCollection(this.availableCollections[0]);
          } else {
            this.showCollectionError('No collections found in metadata document. Please add collection names to _metadata/collections/list array.');
          }
        } else {
          this.showCollectionError('Metadata document not found. Please create _metadata/collections with a "list" array field.');
        }
      })
      .catch((error) => {
        console.error('Error loading collections:', error);
        this.showCollectionError('Error loading collections: ' + error.message);
      });
  }

  // Display collection buttons
  displayCollectionButtons() {
    const container = document.getElementById('collectionButtons');
    container.innerHTML = '';

    this.availableCollections.forEach(collectionName => {
      const item = document.createElement('div');
      item.className = 'collection-item';
      item.dataset.collection = collectionName;

      const nameBtn = document.createElement('button');
      nameBtn.className = 'collection-name-btn';
      nameBtn.textContent = collectionName;
      nameBtn.addEventListener('click', () => this.switchCollection(collectionName));

      const manageBtns = document.createElement('div');
      manageBtns.className = 'collection-manage-btns';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'collection-manage-btn rename';
      renameBtn.textContent = '✏️';
      renameBtn.title = 'Rename collection';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.renameCollection(collectionName);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'collection-manage-btn delete';
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Delete collection';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteCollection(collectionName);
      });

      manageBtns.appendChild(renameBtn);
      manageBtns.appendChild(deleteBtn);

      item.appendChild(nameBtn);
      item.appendChild(manageBtns);
      container.appendChild(item);
    });
  }

  // Switch to a different collection
  switchCollection(collectionName) {
    // Unsubscribe from previous collection
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    // Reset detected fields for new collection
    this.detectedFields = new Set();

    // Set new collection
    this.collectionName = collectionName;
    this.collection = this.db.collection(collectionName);

    // Update active item
    document.querySelectorAll('.collection-item').forEach(item => {
      if (item.dataset.collection === collectionName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update header
    const header = document.querySelector('.cats-header h2');
    if (header) {
      header.textContent = `🗄️ ${collectionName.charAt(0).toUpperCase() + collectionName.slice(1)} Collection`;
    }

    // Load data for this collection
    this.loadData();
    this.setupRealtimeListener();
  }

  // Create new collection
  async createCollection() {
    const collectionName = prompt('Enter new collection name:\n\n(lowercase, no spaces, e.g., "products", "users")');

    if (!collectionName) return;

    const trimmedName = collectionName.trim().toLowerCase();

    // Validate collection name
    if (!trimmedName) {
      alert('Collection name cannot be empty');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(trimmedName)) {
      alert('Collection name can only contain lowercase letters, numbers, and underscores');
      return;
    }

    if (this.availableCollections.includes(trimmedName)) {
      alert(`Collection "${trimmedName}" already exists`);
      return;
    }

    try {
      // Add to metadata
      const updatedList = [...this.availableCollections, trimmedName].sort();
      await this.db.collection('_metadata').doc('collections').update({
        list: updatedList
      });

      this.showMessage('Collection created successfully!', 'success');
      this.availableCollections = updatedList;
      this.displayCollectionButtons();
      this.switchCollection(trimmedName);

    } catch (error) {
      console.error('Error creating collection:', error);
      alert('Error creating collection: ' + error.message);
    }
  }

  // Rename collection
  async renameCollection(oldName) {
    const newName = prompt(`Rename collection "${oldName}" to:`, oldName);

    if (!newName || newName === oldName) return;

    const trimmedName = newName.trim().toLowerCase();

    // Validate new name
    if (!trimmedName) {
      alert('Collection name cannot be empty');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(trimmedName)) {
      alert('Collection name can only contain lowercase letters, numbers, and underscores');
      return;
    }

    if (this.availableCollections.includes(trimmedName)) {
      alert(`Collection "${trimmedName}" already exists`);
      return;
    }

    const confirmRename = confirm(
      `⚠️ WARNING: Renaming a collection in the metadata does NOT rename the actual Firestore collection.\n\n` +
      `This will only update the list of collections shown in this app.\n\n` +
      `To truly rename a Firestore collection, you must:\n` +
      `1. Create a new collection with the new name\n` +
      `2. Copy all documents to the new collection\n` +
      `3. Delete the old collection\n\n` +
      `Do you want to update the metadata to show "${trimmedName}" instead of "${oldName}"?`
    );

    if (!confirmRename) return;

    try {
      // Update metadata
      const updatedList = this.availableCollections
        .map(name => name === oldName ? trimmedName : name)
        .sort();

      await this.db.collection('_metadata').doc('collections').update({
        list: updatedList
      });

      this.showMessage('Collection name updated in metadata!', 'success');
      this.availableCollections = updatedList;
      this.displayCollectionButtons();

      if (this.collectionName === oldName) {
        this.switchCollection(trimmedName);
      }

    } catch (error) {
      console.error('Error renaming collection:', error);
      alert('Error renaming collection: ' + error.message);
    }
  }

  // Delete collection
  async deleteCollection(collectionName) {
    const confirmDelete = confirm(
      `⚠️ WARNING: Are you sure you want to delete the "${collectionName}" collection?\n\n` +
      `This will:\n` +
      `1. Remove "${collectionName}" from the metadata list\n` +
      `2. Optionally delete ALL documents in the "${collectionName}" Firestore collection\n\n` +
      `This action cannot be undone!`
    );

    if (!confirmDelete) return;

    const deleteDocuments = confirm(
      `Do you also want to DELETE ALL DOCUMENTS in the "${collectionName}" Firestore collection?\n\n` +
      `Click OK to delete all documents (irreversible)\n` +
      `Click Cancel to only remove from metadata (documents remain in Firestore)`
    );

    try {
      // Remove from metadata first
      const updatedList = this.availableCollections.filter(name => name !== collectionName);

      await this.db.collection('_metadata').doc('collections').update({
        list: updatedList
      });

      // Delete all documents if requested
      if (deleteDocuments) {
        this.showStatus('🗑️ Deleting documents...', 'info');
        const snapshot = await this.db.collection(collectionName).get();
        const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        this.showMessage(`Collection "${collectionName}" and ${snapshot.docs.length} documents deleted!`, 'success');
      } else {
        this.showMessage(`Collection "${collectionName}" removed from metadata!`, 'success');
      }

      this.availableCollections = updatedList;
      this.displayCollectionButtons();

      // Switch to first collection if we deleted the active one
      if (this.collectionName === collectionName && updatedList.length > 0) {
        this.switchCollection(updatedList[0]);
      } else if (updatedList.length === 0) {
        this.showStatus('✅ Connected to Firestore', 'connected');
        const display = document.getElementById('catsDisplay');
        display.innerHTML = `
          <div class="no-cats-message">
            <h3>No collections</h3>
            <p>Click "+ New Collection" to create your first collection!</p>
          </div>
        `;
      }

    } catch (error) {
      console.error('Error deleting collection:', error);
      alert('Error deleting collection: ' + error.message);
    }
  }

  // Show collection error
  showCollectionError(message) {
    const container = document.getElementById('collectionButtons');
    container.innerHTML = `
      <p style="color: #dc3545; font-style: italic; margin-bottom: 15px;">${message}</p>
      <button id="autoCreateMetadataBtn" class="btn" style="margin: 0;">Auto-Create Metadata Document</button>
    `;

    const display = document.getElementById('catsDisplay');
    display.innerHTML = `
      <div class="no-cats-message">
        <h3>⚠️ Setup Required</h3>
        <p>${message}</p>
        <p style="margin-top: 20px;">Click the button above to automatically scan your Firestore and create the metadata document, or create it manually:</p>
        <ol style="text-align: left; max-width: 600px; margin: 20px auto; line-height: 1.8;">
          <li>Go to Firestore Database in Firebase Console</li>
          <li>Create collection: <code>_metadata</code></li>
          <li>Create document: <code>collections</code></li>
          <li>Add field: <code>list</code> (type: array)</li>
          <li>Add your collection names to the array (e.g., ["cat", "book"])</li>
          <li>Refresh this page</li>
        </ol>
      </div>
    `;

    // Add event listener for auto-create button
    setTimeout(() => {
      const btn = document.getElementById('autoCreateMetadataBtn');
      if (btn) {
        btn.addEventListener('click', () => this.autoCreateMetadata());
      }
    }, 100);
  }

  // Auto-create metadata document by scanning Firestore
  async autoCreateMetadata() {
    try {
      this.showStatus('🔍 Scanning Firestore collections...', 'info');

      // Get all root-level collections
      const collections = await this.db.listCollections();
      const collectionNames = collections
        .map(col => col.id)
        .filter(name => name !== '_metadata'); // Exclude metadata itself

      if (collectionNames.length === 0) {
        alert('No collections found in your Firestore database. Please create at least one collection first (e.g., "cat" or "book").');
        return;
      }

      // Create the metadata document
      await this.db.collection('_metadata').doc('collections').set({
        list: collectionNames
      });

      this.showMessage('Metadata document created successfully!', 'success');
      this.showStatus('✅ Metadata created, loading collections...', 'connected');

      // Reload collections list
      setTimeout(() => {
        this.loadCollectionsList();
      }, 500);

    } catch (error) {
      console.error('Error auto-creating metadata:', error);

      // If listCollections() fails (only available in Admin SDK), ask user for collection names
      if (error.message.includes('listCollections') || error.code === 'permission-denied') {
        this.promptForCollectionNames();
      } else {
        alert('Error creating metadata: ' + error.message);
      }
    }
  }

  // Prompt user to enter collection names manually
  promptForCollectionNames() {
    const collectionNames = prompt(
      'Enter your collection names separated by commas:\n\n(e.g., cat, book, products)',
      'cat, book'
    );

    if (!collectionNames) return;

    const list = collectionNames.split(',').map(name => name.trim()).filter(name => name);

    if (list.length === 0) {
      alert('Please enter at least one collection name');
      return;
    }

    // Create the metadata document
    this.db.collection('_metadata').doc('collections').set({
      list: list
    })
    .then(() => {
      this.showMessage('Metadata document created successfully!', 'success');
      this.showStatus('✅ Metadata created, loading collections...', 'connected');

      // Reload collections list
      setTimeout(() => {
        this.loadCollectionsList();
      }, 500);
    })
    .catch((error) => {
      console.error('Error creating metadata:', error);
      alert('Error creating metadata: ' + error.message);
    });
  }

  showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('firebaseStatus');
    statusDiv.className = `firebase-status ${type}`;
    statusDiv.innerHTML = `<p>${message}</p>`;
  }

  // Initialize the dynamic form with one empty field
  initializeForm() {
    this.addFieldRow();
  }

  // Add a new field row to the form
  addFieldRow(fieldName = '', fieldValue = '', fieldType = 'string') {
    const container = document.getElementById('dynamicFields');
    const row = document.createElement('div');
    row.className = 'field-row';

    row.innerHTML = `
      <input type="text" class="field-name" placeholder="Field name" value="${this.escapeHtml(fieldName)}">
      <select class="field-type-select">
        <option value="string" ${fieldType === 'string' ? 'selected' : ''}>String</option>
        <option value="number" ${fieldType === 'number' ? 'selected' : ''}>Number</option>
        <option value="boolean" ${fieldType === 'boolean' ? 'selected' : ''}>Boolean</option>
        <option value="reference" ${fieldType === 'reference' ? 'selected' : ''}>Reference</option>
      </select>
      <div style="display: flex; gap: 5px; flex: 1;">
        <input type="text" class="field-value" placeholder="Field value" value="${this.escapeHtml(fieldValue)}" style="flex: 1;">
        <button class="pick-reference-btn" style="display: none; padding: 10px 15px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; white-space: nowrap;">📋 Pick</button>
      </div>
      <button class="remove-field-btn">✕</button>
    `;

    const removeBtn = row.querySelector('.remove-field-btn');
    removeBtn.addEventListener('click', () => {
      row.remove();
      // Ensure at least one field remains
      if (container.children.length === 0) {
        this.addFieldRow();
      }
    });

    // Auto-suggest fields based on detected schema
    const fieldNameInput = row.querySelector('.field-name');
    fieldNameInput.addEventListener('focus', () => {
      if (this.detectedFields.size > 0 && !fieldNameInput.value) {
        const suggestion = Array.from(this.detectedFields).join(', ');
        fieldNameInput.placeholder = `e.g., ${suggestion}`;
      }
    });

    // Update placeholder based on type
    const typeSelect = row.querySelector('.field-type-select');
    const valueInput = row.querySelector('.field-value');
    const pickRefBtn = row.querySelector('.pick-reference-btn');

    const updatePlaceholder = () => {
      const type = typeSelect.value;
      switch (type) {
        case 'string':
          valueInput.placeholder = 'Enter text value';
          pickRefBtn.style.display = 'none';
          break;
        case 'number':
          valueInput.placeholder = 'Enter number (e.g., 42 or 3.14)';
          pickRefBtn.style.display = 'none';
          break;
        case 'boolean':
          valueInput.placeholder = 'Enter true or false';
          pickRefBtn.style.display = 'none';
          break;
        case 'reference':
          valueInput.placeholder = 'Enter path (e.g., cat/0 or book/abc123)';
          pickRefBtn.style.display = 'block';
          break;
      }
    };

    typeSelect.addEventListener('change', updatePlaceholder);
    updatePlaceholder();

    // Reference picker
    pickRefBtn.addEventListener('click', () => {
      this.showReferencePicker(valueInput);
    });

    container.appendChild(row);
  }

  // Show reference picker dialog
  async showReferencePicker(targetInput) {
    try {
      // Create modal
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2999; display: flex; align-items: center; justify-content: center;';

      const modal = document.createElement('div');
      modal.style.cssText = 'background: white; padding: 30px; border-radius: 10px; max-width: 600px; max-height: 80vh; overflow-y: auto; width: 90%;';
      modal.innerHTML = '<h3 style="margin-top: 0;">Select Reference</h3><div id="refPickerContent"><p style="text-align: center; color: #6c757d;">Loading documents...</p></div>';

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const close = () => overlay.remove();
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });

      // Load all documents from all collections
      const content = modal.querySelector('#refPickerContent');
      content.innerHTML = '';

      for (const collectionName of this.availableCollections) {
        const snapshot = await this.db.collection(collectionName).get();

        if (snapshot.docs.length > 0) {
          const collectionDiv = document.createElement('div');
          collectionDiv.style.cssText = 'margin-bottom: 20px;';

          const collectionHeader = document.createElement('h4');
          collectionHeader.textContent = collectionName;
          collectionHeader.style.cssText = 'color: #667eea; margin-bottom: 10px;';
          collectionDiv.appendChild(collectionHeader);

          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const firstField = Object.keys(data).find(k => k !== 'timestamp');
            const displayText = firstField ? data[firstField] : doc.id;

            const docBtn = document.createElement('button');
            docBtn.textContent = `${displayText} (${doc.id})`;
            docBtn.style.cssText = 'display: block; width: 100%; padding: 10px; margin-bottom: 5px; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 6px; cursor: pointer; text-align: left; transition: all 0.2s;';
            docBtn.addEventListener('mouseenter', () => {
              docBtn.style.background = '#e9ecef';
              docBtn.style.borderColor = '#667eea';
            });
            docBtn.addEventListener('mouseleave', () => {
              docBtn.style.background = '#f8f9fa';
              docBtn.style.borderColor = '#dee2e6';
            });
            docBtn.addEventListener('click', () => {
              targetInput.value = `${collectionName}/${doc.id}`;
              close();
              this.showMessage('Reference selected!', 'success');
            });

            collectionDiv.appendChild(docBtn);
          });

          content.appendChild(collectionDiv);
        }
      }

      if (content.children.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #6c757d;">No documents found in any collection.</p>';
      }

    } catch (error) {
      console.error('Error loading references:', error);
      alert('Error loading references: ' + error.message);
    }
  }

  // Detect fields from existing data
  detectFields(documents) {
    if (!documents || documents.length === 0) return;

    documents.forEach(doc => {
      const data = doc.data();
      Object.keys(data).forEach(key => {
        if (key !== 'timestamp') { // Skip internal fields
          this.detectedFields.add(key);
        }
      });
    });
  }

  // Setup realtime listener for data changes
  setupRealtimeListener() {
    if (!this.initialized) return;

    this.unsubscribe = this.collection.onSnapshot((snapshot) => {
      const documents = snapshot.docs;
      this.detectFields(documents);
      this.displayData(documents);
    }, (error) => {
      console.error('Error loading data:', error);
      this.showStatus(`❌ Error loading data: ${error.message}`, 'error');
    });
  }

  // Load all data from database
  loadData() {
    if (!this.initialized) {
      this.showConfigInstructions();
      return;
    }

    this.collection.get()
      .then((snapshot) => {
        const documents = snapshot.docs;
        this.detectFields(documents);
        this.displayData(documents);
      })
      .catch((error) => {
        console.error('Error loading data:', error);
        this.showStatus(`❌ Error loading data: ${error.message}`, 'error');
      });
  }

  // Display data in the UI
  displayData(documents) {
    const display = document.getElementById('catsDisplay');

    if (!documents || documents.length === 0) {
      display.innerHTML = `
        <div class="no-cats-message">
          <h3>No data in collection</h3>
          <p>Add your first entry using the form above!</p>
          <p style="font-size: 0.9em; margin-top: 10px;">The database will automatically adapt to whatever structure you create.</p>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'cats-grid';

    documents.forEach(doc => {
      const entry = {
        id: doc.id,
        ...doc.data()
      };
      const card = this.createDataCard(entry);
      grid.appendChild(card);
    });

    display.innerHTML = '';
    display.appendChild(grid);
  }

  // Get field type priority for sorting
  getFieldTypePriority(value) {
    if (typeof value === 'string') return 0; // Strings first
    if (typeof value === 'number') return 1; // Numbers second
    if (typeof value === 'boolean') return 2; // Booleans third
    if (this.isReference(value)) return 3; // References fourth
    if (value && typeof value.toDate === 'function') return 5; // Timestamps last
    return 4; // Other objects
  }

  // Format a value for display as card title
  formatTitleValue(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (this.isReference(value)) {
      const refInfo = this.extractReferenceInfo(value);
      return refInfo ? refInfo.path : 'Reference';
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return 'Entry';
  }

  // Create a data card element
  createDataCard(entry) {
    const card = document.createElement('div');
    card.className = 'cat-card';

    // Sort fields by type (strings first, then numbers, booleans, references, objects, timestamps)
    const sortedEntries = Object.entries(entry).sort(([keyA, valueA], [keyB, valueB]) => {
      // Always keep 'id' at the end
      if (keyA === 'id') return 1;
      if (keyB === 'id') return -1;

      // Always keep 'timestamp' near the end (but before id)
      if (keyA === 'timestamp') return 1;
      if (keyB === 'timestamp') return -1;

      // Sort by type priority
      const priorityA = this.getFieldTypePriority(valueA);
      const priorityB = this.getFieldTypePriority(valueB);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If same type, sort alphabetically by key
      return keyA.localeCompare(keyB);
    });

    // Get the first field value as the title from sorted entries (skip id and timestamp)
    const firstEntry = sortedEntries.find(([key]) => key !== 'id' && key !== 'timestamp');
    const title = firstEntry ? this.formatTitleValue(firstEntry[1]) : 'Entry';

    // Build the card body with all fields
    let fieldsHTML = '';
    sortedEntries.forEach(([key, value]) => {
      if (key === 'id') return; // Skip ID in body

      if (key === 'timestamp') {
        // Handle Firestore Timestamp objects
        let dateStr;
        if (value && typeof value.toDate === 'function') {
          dateStr = value.toDate().toLocaleString();
        } else if (typeof value === 'number') {
          dateStr = new Date(value).toLocaleString();
        } else {
          dateStr = String(value);
        }
        fieldsHTML += `<p class="cat-id">Added: ${dateStr}</p>`;
      } else if (this.isReference(value)) {
        // Handle Firestore DocumentReference
        const refInfo = this.extractReferenceInfo(value);
        if (refInfo) {
          fieldsHTML += `<p><strong>${this.escapeHtml(key)}:</strong> <span class="ref-path">${this.escapeHtml(refInfo.path)}</span> <button class="reference-btn" data-ref-collection="${refInfo.collection}" data-ref-doc="${refInfo.docId}">Go to</button></p>`;
        } else {
          // Fallback if extraction fails
          fieldsHTML += `<p><strong>${this.escapeHtml(key)}:</strong> <span class="ref-path">Reference (path extraction failed)</span></p>`;
        }
      } else {
        // Handle different value types
        let displayValue = value;
        if (typeof value === 'object' && value !== null) {
          displayValue = JSON.stringify(value);
        } else if (typeof value === 'boolean') {
          displayValue = value ? '✓ Yes' : '✗ No';
        }

        fieldsHTML += `<p><strong>${this.escapeHtml(key)}:</strong> ${this.escapeHtml(String(displayValue))}</p>`;
      }
    });

    card.innerHTML = `
      <div class="cat-card-header">
        <h3>${this.escapeHtml(String(title))}</h3>
        <div class="cat-card-actions">
          <button class="edit-cat-btn" data-id="${entry.id}">Edit</button>
          <button class="delete-cat-btn" data-id="${entry.id}">Delete</button>
        </div>
      </div>
      <div class="cat-card-body">
        ${fieldsHTML}
        <p class="cat-id">ID: ${entry.id}</p>
      </div>
    `;

    // Add event listeners
    const editBtn = card.querySelector('.edit-cat-btn');
    const deleteBtn = card.querySelector('.delete-cat-btn');

    editBtn.addEventListener('click', () => this.editEntry(entry));
    deleteBtn.addEventListener('click', () => this.deleteEntry(entry.id, title));

    // Add event listeners for reference buttons
    const refButtons = card.querySelectorAll('.reference-btn');
    refButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const refCollection = btn.dataset.refCollection;
        const refDoc = btn.dataset.refDoc;
        this.navigateToReference(refCollection, refDoc);
      });
    });

    return card;
  }

  // Check if a value is a Firestore DocumentReference
  isReference(value) {
    if (!value || typeof value !== 'object') return false;

    // Check for compat SDK reference structure
    if (value._delegate &&
        value._delegate.type === 'document' &&
        value._delegate._key &&
        value._delegate._key.path) {
      return true;
    }

    // Check for standard reference structure
    if (value.constructor &&
        (value.constructor.name === 'DocumentReference' ||
         value.constructor.name === 'DocumentReferenceCompat') &&
        value.path) {
      return true;
    }

    return false;
  }

  // Extract collection and document ID from reference
  extractReferenceInfo(value) {
    // Handle compat SDK reference
    if (value._delegate && value._delegate._key && value._delegate._key.path) {
      const segments = value._delegate._key.path.segments;
      // Segments look like: ["projects", "projectId", "databases", "(default)", "documents", "collection", "docId"]
      // We need to find "documents" and take the next two items
      const docIndex = segments.indexOf('documents');
      if (docIndex !== -1 && segments.length >= docIndex + 3) {
        const collection = segments[docIndex + 1];
        const docId = segments[docIndex + 2];
        return { collection, docId, path: `${collection}/${docId}` };
      }
    }

    // Handle standard reference with .path property
    if (value.path) {
      const parts = value.path.split('/');
      if (parts.length >= 2) {
        return {
          collection: parts[0],
          docId: parts[1],
          path: value.path
        };
      }
    }

    return null;
  }

  // Navigate to a referenced document and highlight it
  navigateToReference(collectionName, docId) {
    // Check if this collection exists in available collections
    if (!this.availableCollections.includes(collectionName)) {
      alert(`Collection "${collectionName}" not found in metadata. Please add it to _metadata/collections/list first.`);
      return;
    }

    // Switch to the collection
    this.switchCollection(collectionName);

    // Wait for data to load, then scroll to and highlight the document
    setTimeout(() => {
      this.highlightDocument(docId);
    }, 500);
  }

  // Highlight a specific document
  highlightDocument(docId) {
    // Find the card with this document ID
    const cards = document.querySelectorAll('.cat-card');
    let targetCard = null;

    cards.forEach(card => {
      const idElement = card.querySelector('.cat-id:last-child');
      if (idElement && idElement.textContent.includes(docId)) {
        targetCard = card;
      }
    });

    if (targetCard) {
      // Scroll to the card
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add highlight class
      targetCard.classList.add('highlight');

      // Remove highlight after animation
      setTimeout(() => {
        targetCard.classList.remove('highlight');
      }, 2000);

      this.showMessage(`Navigated to document: ${docId}`, 'info');
    } else {
      alert(`Document "${docId}" not found in collection.`);
    }
  }

  // Get data from the form
  getFormData() {
    const fields = document.querySelectorAll('.field-row');
    const data = {};
    let hasData = false;

    fields.forEach(row => {
      const nameInput = row.querySelector('.field-name');
      const typeSelect = row.querySelector('.field-type-select');
      const valueInput = row.querySelector('.field-value');
      const name = nameInput.value.trim();
      const type = typeSelect.value;
      const value = valueInput.value.trim();

      if (name && value) {
        let parsedValue;

        switch (type) {
          case 'number':
            parsedValue = parseFloat(value);
            if (isNaN(parsedValue)) {
              alert(`Field "${name}": "${value}" is not a valid number`);
              return;
            }
            break;

          case 'boolean':
            if (value.toLowerCase() === 'true') {
              parsedValue = true;
            } else if (value.toLowerCase() === 'false') {
              parsedValue = false;
            } else {
              alert(`Field "${name}": "${value}" is not a valid boolean (use "true" or "false")`);
              return;
            }
            break;

          case 'reference':
            // Parse reference path (e.g., "cat/0" or "book/abc123")
            const parts = value.split('/');
            if (parts.length !== 2) {
              alert(`Field "${name}": Reference must be in format "collection/documentId" (e.g., "cat/0")`);
              return;
            }
            const [refCollection, refDocId] = parts;
            parsedValue = this.db.collection(refCollection).doc(refDocId);
            break;

          case 'string':
          default:
            parsedValue = value;
            break;
        }

        data[name] = parsedValue;
        hasData = true;
      }
    });

    return hasData ? data : null;
  }

  // Add a new entry
  addEntry() {
    if (!this.initialized) {
      alert('Firebase not initialized. Please configure Firebase first.');
      return;
    }

    const data = this.getFormData();

    if (!data) {
      alert('Please fill in at least one field with both name and value');
      return;
    }

    // Add timestamp
    data.timestamp = firebase.firestore.FieldValue.serverTimestamp();

    this.collection.add(data)
      .then(() => {
        console.log('Entry added successfully');
        this.clearForm();
        this.showMessage('Entry added successfully!', 'success');
      })
      .catch((error) => {
        console.error('Error adding entry:', error);
        alert('Error adding entry: ' + error.message);
      });
  }

  // Edit an entry
  editEntry(entry) {
    // Build edit form dynamically
    let editHTML = '<div style="max-width: 500px;">';
    const fields = {};

    Object.entries(entry).forEach(([key, value]) => {
      if (key === 'id' || key === 'timestamp') return;

      let valueStr;
      if (typeof value === 'object' && value !== null) {
        valueStr = JSON.stringify(value);
      } else {
        valueStr = String(value);
      }

      fields[key] = valueStr;
      editHTML += `
        <div style="margin-bottom: 10px;">
          <label style="display: block; font-weight: bold; margin-bottom: 5px;">${key}:</label>
          <input type="text" id="edit_${key}" value="${this.escapeHtml(valueStr)}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
      `;
    });

    editHTML += '</div>';

    // Create modal-like edit interface
    const editContainer = document.createElement('div');
    editContainer.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 3000; max-height: 80vh; overflow-y: auto;';
    editContainer.innerHTML = `
      <h3 style="margin-top: 0;">Edit Entry</h3>
      ${editHTML}
      <div style="margin-top: 20px; display: flex; gap: 10px;">
        <button id="saveEditBtn" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">Save</button>
        <button id="cancelEditBtn" style="flex: 1; padding: 10px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2999;';

    document.body.appendChild(overlay);
    document.body.appendChild(editContainer);

    const close = () => {
      overlay.remove();
      editContainer.remove();
    };

    document.getElementById('cancelEditBtn').addEventListener('click', close);
    overlay.addEventListener('click', close);

    document.getElementById('saveEditBtn').addEventListener('click', () => {
      const updates = {};
      Object.keys(fields).forEach(key => {
        const input = document.getElementById(`edit_${key}`);
        if (input) {
          let value = input.value.trim();
          // Try to parse as number or boolean
          if (!isNaN(value) && value !== '') {
            value = parseFloat(value);
          } else if (value.toLowerCase() === 'true') {
            value = true;
          } else if (value.toLowerCase() === 'false') {
            value = false;
          }
          updates[key] = value;
        }
      });

      this.collection.doc(entry.id).update(updates)
        .then(() => {
          console.log('Entry updated successfully');
          this.showMessage('Entry updated successfully!', 'success');
          close();
        })
        .catch((error) => {
          console.error('Error updating entry:', error);
          alert('Error updating entry: ' + error.message);
        });
    });
  }

  // Delete an entry
  deleteEntry(id, title) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    this.collection.doc(id).delete()
      .then(() => {
        console.log('Entry deleted successfully');
        this.showMessage('Entry deleted successfully!', 'success');
      })
      .catch((error) => {
        console.error('Error deleting entry:', error);
        alert('Error deleting entry: ' + error.message);
      });
  }

  // Clear the form inputs
  clearForm() {
    document.getElementById('dynamicFields').innerHTML = '';
    this.addFieldRow();
  }

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Show a temporary message
  showMessage(text, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = text;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => messageDiv.remove(), 300);
    }, 2000);
  }

  // Cleanup on destroy
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Initialize the database when the page loads
let dynamicDB;

// Wait for Firebase SDK to load
function waitForFirebase(callback, attempts = 0) {
  if (typeof firebase !== 'undefined' && firebase.firestore) {
    callback();
  } else if (attempts < 50) { // Try for 5 seconds
    setTimeout(() => waitForFirebase(callback, attempts + 1), 100);
  } else {
    console.error('Firebase SDK failed to load');
    const statusDiv = document.getElementById('firebaseStatus');
    if (statusDiv) {
      statusDiv.className = 'firebase-status error';
      statusDiv.innerHTML = '<p>❌ Firebase SDK failed to load. Please refresh the page.</p>';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  dynamicDB = new DynamicDatabase();

  // Wait for Firebase SDK to be fully loaded
  waitForFirebase(() => {
    dynamicDB.initialize();
  });

  // Setup event listeners with null checks
  const addFieldBtn = document.getElementById('addFieldBtn');
  if (addFieldBtn) {
    addFieldBtn.addEventListener('click', () => {
      dynamicDB.addFieldRow();
    });
  }

  const addEntryBtn = document.getElementById('addEntryBtn');
  if (addEntryBtn) {
    addEntryBtn.addEventListener('click', () => {
      dynamicDB.addEntry();
    });
  }

  const refreshBtn = document.getElementById('refreshCatsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      dynamicDB.loadData();
      dynamicDB.showMessage('Data refreshed!', 'info');
    });
  }

  const createCollectionBtn = document.getElementById('createCollectionBtn');
  if (createCollectionBtn) {
    createCollectionBtn.addEventListener('click', () => {
      dynamicDB.createCollection();
    });
  }
});
