// VIP Background Customization
const BG_STORAGE_KEY = 'msg_vip_background';
const gradients = {
    gradient1: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    gradient2: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    gradient3: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    gradient4: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    gradient5: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    gradient6: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)'
};

// Check if user is VIP
async function checkVIPStatus(username) {
    if (!username) return false;
    
    try {
        console.log('Checking VIP status for username:', username);
        const { data, error } = await window.supabaseClient
            .from('user_name')
            .select('is_vip')
            .eq('username', username)
            .single();
        
        console.log('VIP check result:', { data, error });
        
        if (error) {
            console.error('Error checking VIP status:', error);
            return false;
        }
        
        const isVIP = data?.is_vip || false;
        console.log('User', username, 'is VIP:', isVIP);
        return isVIP;
    } catch (err) {
        console.error('Failed to check VIP status:', err);
        return false;
    }
}

// Initialize VIP background features
async function initVIPBackground() {
    const changeBgBtn = document.getElementById('change-bg-btn');
    const bgModal = document.getElementById('bg-modal');
    const closeModal = document.querySelector('.close-modal');
    const bgOptions = document.querySelectorAll('.bg-option');
    const applyColorBtn = document.getElementById('apply-color-bg');
    const customColorInput = document.getElementById('custom-bg-color');
    const uploadBtn = document.getElementById('upload-bg-btn');
    const bgImageInput = document.getElementById('bg-image-input');
    const bgFileName = document.getElementById('bg-file-name');
    const resetBtn = document.getElementById('reset-bg-btn');
    
    // Check if user is VIP
    const username = window.currentUser || localStorage.getItem('msg_username');
    console.log('Initializing VIP background for user:', username);
    
    // ALWAYS load saved background first, regardless of VIP status
    await loadSavedBackground();
    
    // Then check VIP status for button visibility
    const isVIP = await checkVIPStatus(username);
    console.log('VIP check complete, isVIP:', isVIP);
    
    if (isVIP && changeBgBtn) {
        changeBgBtn.style.display = 'block';
        console.log('Change background button shown for VIP user');
    } else {
        console.log('Change background button hidden - not VIP or button not found');
    }
    
    // Change background button click
    if (changeBgBtn) {
        changeBgBtn.addEventListener('click', () => {
            bgModal.style.display = 'block';
        });
    }
    
    // Close modal
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            bgModal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === bgModal) {
            bgModal.style.display = 'none';
        }
    });
    
    // Preset background selection
    bgOptions.forEach(option => {
        option.addEventListener('click', async () => {
            bgOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            
            const bgType = option.dataset.bg;
            const gradient = gradients[bgType];
            applyBackground('gradient', gradient);
            await saveBackground('gradient', gradient);
        });
    });
    
    // Custom color
    if (applyColorBtn) {
        applyColorBtn.addEventListener('click', async () => {
            const color = customColorInput.value;
            applyBackground('color', color);
            await saveBackground('color', color);
            bgOptions.forEach(opt => opt.classList.remove('selected'));
        });
    }
    
    // Upload image
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            bgImageInput.click();
        });
    }
    
    if (bgImageInput) {
        bgImageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const imageUrl = e.target.result;
                    applyBackground('image', imageUrl);
                    await saveBackground('image', imageUrl);
                    bgFileName.textContent = file.name;
                    bgOptions.forEach(opt => opt.classList.remove('selected'));
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Reset background
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            await resetBackground();
            applyBackground('default', '#36393f');
            bgOptions.forEach(opt => opt.classList.remove('selected'));
            bgFileName.textContent = '';
            bgModal.style.display = 'none';
        });
    }
}

// Apply background to home screen
function applyBackground(type, value) {
    const homeScreen = document.getElementById('home-screen');
    if (!homeScreen) return;
    
    switch (type) {
        case 'gradient':
            homeScreen.style.background = value;
            break;
        case 'color':
            homeScreen.style.background = value;
            break;
        case 'image':
            homeScreen.style.background = `url('${value}') center/cover no-repeat`;
            break;
        case 'default':
            homeScreen.style.background = '';
            break;
    }
}

// Save background preference to Supabase
async function saveBackground(type, value) {
    const username = window.currentUser || localStorage.getItem('msg_username');
    if (!username) return;
    
    console.log('Starting background save for username:', username);
    
    const bgData = { type, value };
    console.log('Background data to save:', bgData);
    
    try {
        // Check if profile exists
        console.log('Checking if profile exists...');
        const { data: existingProfile, error: checkError } = await window.supabaseClient
            .from('profile_items')
            .select('id')
            .eq('username', username)
            .single();
        
        console.log('Check result:', { existingProfile, checkError });
        
        let result;
        if (existingProfile && !checkError) {
            // Update existing profile
            console.log('Updating existing profile with background...');
            result = await window.supabaseClient
                .from('profile_items')
                .update({
                    background: JSON.stringify(bgData)
                })
                .eq('username', username)
                .select();
        } else {
            // Insert new profile with background
            console.log('Inserting new profile with background...');
            result = await window.supabaseClient
                .from('profile_items')
                .insert([{
                    username: username,
                    background: JSON.stringify(bgData)
                }])
                .select();
        }
        
        console.log('Background save result:', result);
        
        if (result.error) {
            console.error('Error saving background:', result.error);
            alert('Failed to save background: ' + result.error.message);
        } else {
            // Also save to localStorage as backup
            localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(bgData));
            console.log('Background saved successfully!');
        }
    } catch (err) {
        console.error('Failed to save background to Supabase:', err);
        alert('Failed to save background: ' + err.message);
        // Fallback to localStorage
        localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(bgData));
    }
}

// Load saved background from Supabase
async function loadSavedBackground() {
    const username = window.currentUser || localStorage.getItem('msg_username');
    if (!username) return;
    
    try {
        // Load from Supabase
        const { data, error } = await window.supabaseClient
            .from('profile_items')
            .select('*')
            .eq('username', username)
            .maybeSingle();
        
        if (error) {
            console.error('Error loading background:', error);
        }
        
        if (data && data.background) {
            console.log('Loaded background data:', data.background);
            const bgData = JSON.parse(data.background);
            applyBackground(bgData.type, bgData.value);
            
            // Update UI to show selected option
            if (bgData.type === 'gradient') {
                const bgOptions = document.querySelectorAll('.bg-option');
                bgOptions.forEach(option => {
                    if (gradients[option.dataset.bg] === bgData.value) {
                        option.classList.add('selected');
                    }
                });
            }
        } else {
            // Fallback to localStorage
            const saved = localStorage.getItem(BG_STORAGE_KEY);
            if (saved) {
                const { type, value } = JSON.parse(saved);
                applyBackground(type, value);
                
                // Update UI to show selected option
                if (type === 'gradient') {
                    const bgOptions = document.querySelectorAll('.bg-option');
                    bgOptions.forEach(option => {
                        if (gradients[option.dataset.bg] === value) {
                            option.classList.add('selected');
                        }
                    });
                }
            }
        }
    } catch (err) {
        console.error('Failed to load background from Supabase:', err);
        // Fallback to localStorage
        const saved = localStorage.getItem(BG_STORAGE_KEY);
        if (saved) {
            const { type, value } = JSON.parse(saved);
            applyBackground(type, value);
        }
    }
}

// Reset background
async function resetBackground() {
    const username = window.currentUser || localStorage.getItem('msg_username');
    if (!username) return;
    
    try {
        // Update Supabase to remove background
        await window.supabaseClient
            .from('profile_items')
            .update({
                background: null
            })
            .eq('username', username);
        
        // Remove from localStorage
        localStorage.removeItem(BG_STORAGE_KEY);
    } catch (err) {
        console.error('Failed to reset background:', err);
        localStorage.removeItem(BG_STORAGE_KEY);
    }
}

// Debug function to check VIP status (call from console)
window.debugVIP = async function(username) {
    if (!username) {
        username = window.currentUser || localStorage.getItem('msg_username');
    }
    
    console.log('=== VIP DEBUG FOR:', username, '===');
    
    try {
        // Check if user exists in user_name table
        const { data: userData, error: userError } = await window.supabaseClient
            .from('user_name')
            .select('*')
            .eq('username', username);
        
        console.log('User data:', userData);
        console.log('User error:', userError);
        
        // Check VIP status
        const isVIP = await checkVIPStatus(username);
        console.log('Final VIP status:', isVIP);
        
        return { userData, isVIP };
    } catch (err) {
        console.error('Debug VIP failed:', err);
    }
};

// Debug function to set VIP status (call from console)
window.setVIP = async function(username, isVIP = true) {
    if (!username) {
        username = window.currentUser || localStorage.getItem('msg_username');
    }
    
    console.log('Setting VIP status for', username, 'to', isVIP);
    
    try {
        const { data, error } = await window.supabaseClient
            .from('user_name')
            .update({ is_vip: isVIP })
            .eq('username', username)
            .select();
        
        console.log('VIP update result:', { data, error });
        
        // Refresh the page to apply changes
        if (!error) {
            console.log('VIP status updated! Refreshing page...');
            setTimeout(() => location.reload(), 1000);
        }
        
        return { data, error };
    } catch (err) {
        console.error('Failed to set VIP status:', err);
    }
};

// Export functions
window.initVIPBackground = initVIPBackground;
window.checkVIPStatus = checkVIPStatus; 