// Profile Management
const PROFILE_KEY = 'msg_user_profile';
let selectedColor = '#ffffff';

// Load profile data
function loadProfile() {
    const profile = localStorage.getItem(PROFILE_KEY);
    if (profile) {
        const data = JSON.parse(profile);
        
        // Load profile image
        if (data.image) {
            const img = document.getElementById('profile-image');
            const placeholder = document.getElementById('profile-image-placeholder');
            const removeBtn = document.getElementById('remove-image-btn');
            
            img.src = data.image;
            img.style.display = 'block';
            placeholder.style.display = 'none';
            removeBtn.style.display = 'inline-block';
        }
        
        // Load selected color
        if (data.color) {
            selectedColor = data.color;
            document.getElementById('custom-color').value = data.color;
            
            // Update color selection UI
            document.querySelectorAll('.color-option').forEach(option => {
                if (option.dataset.color === data.color) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            });
        }
    }
}

// Save profile data
function saveProfile() {
    const img = document.getElementById('profile-image');
    const profile = {
        image: img.style.display !== 'none' ? img.src : null,
        color: selectedColor
    };
    
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    alert('Profile saved successfully!');
}

// Get user profile
function getUserProfile(username) {
    // In a real app, this would fetch from a database
    // For now, we'll use the current user's profile for all
    const profile = localStorage.getItem(PROFILE_KEY);
    return profile ? JSON.parse(profile) : { color: '#ffffff' };
}

// Initialize profile functionality
function initProfile() {
    const profileBtn = document.getElementById('profile-btn');
    const profileScreen = document.getElementById('profile-screen');
    const saveBtn = document.getElementById('save-profile-btn');
    const imageContainer = document.getElementById('profile-image-container');
    const imageInput = document.getElementById('profile-image-input');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const colorOptions = document.querySelectorAll('.color-option');
    const customColorInput = document.getElementById('custom-color');
    
    // Profile button click
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            showScreen(profileScreen);
            loadProfile();
        });
    }
    
    // Image upload - click
    if (imageContainer) {
        imageContainer.addEventListener('click', () => {
            imageInput.click();
        });
    }
    
    // Image upload - file selection
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.getElementById('profile-image');
                    const placeholder = document.getElementById('profile-image-placeholder');
                    const removeBtn = document.getElementById('remove-image-btn');
                    
                    img.src = e.target.result;
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                    removeBtn.style.display = 'inline-block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Drag and drop
    if (imageContainer) {
        imageContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageContainer.classList.add('drag-over');
        });
        
        imageContainer.addEventListener('dragleave', () => {
            imageContainer.classList.remove('drag-over');
        });
        
        imageContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            imageContainer.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.getElementById('profile-image');
                    const placeholder = document.getElementById('profile-image-placeholder');
                    const removeBtn = document.getElementById('remove-image-btn');
                    
                    img.src = e.target.result;
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                    removeBtn.style.display = 'inline-block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Remove image
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', () => {
            const img = document.getElementById('profile-image');
            const placeholder = document.getElementById('profile-image-placeholder');
            
            img.src = '';
            img.style.display = 'none';
            placeholder.style.display = 'flex';
            removeImageBtn.style.display = 'none';
        });
    }
    
    // Color selection
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedColor = option.dataset.color;
            customColorInput.value = selectedColor;
        });
    });
    
    // Custom color
    if (customColorInput) {
        customColorInput.addEventListener('change', (e) => {
            selectedColor = e.target.value;
            colorOptions.forEach(opt => opt.classList.remove('selected'));
        });
    }
    
    // Save profile
    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfile);
    }
}

// Export functions
window.initProfile = initProfile;
window.getUserProfile = getUserProfile; 