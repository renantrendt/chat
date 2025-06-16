// Profile Management
const PROFILE_KEY = 'msg_user_profile';
let selectedColor = '#ffffff';

// Profile cache for bulk loading optimization
const profileCache = new Map();
const PROFILE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Bulk load multiple user profiles in a single database query (OPTIMIZATION)
async function getUserProfilesBulk(usernames) {
    if (!usernames || usernames.length === 0) return {};
    
    const result = {};
    const uncachedUsernames = [];
    const now = Date.now();
    
    // Check cache first
    usernames.forEach(username => {
        const cached = profileCache.get(username);
        if (cached && (now - cached.timestamp) < PROFILE_CACHE_DURATION) {
            result[username] = cached.profile;
        } else {
            uncachedUsernames.push(username);
        }
    });
    
    // Load uncached profiles from database in bulk
    if (uncachedUsernames.length > 0) {
        try {
            // Single database query for all uncached profiles
            const { data, error } = await window.supabaseClient
                .from('profile_items')
                .select('*')
                .in('username', uncachedUsernames);
            
            if (error) {
                console.error('Error getting bulk user profiles:', error);
            }
            
            // Process results and fill cache
            const profileMap = new Map(data ? data.map(p => [p.username, p]) : []);
            
            // Get VIP statuses in bulk if available
            let vipStatuses = {};
            if (window.checkVIPStatusBulk) {
                vipStatuses = await window.checkVIPStatusBulk(uncachedUsernames);
            } else if (window.checkVIPStatus) {
                // Fallback to individual VIP checks (still parallel)
                const vipPromises = uncachedUsernames.map(async username => ({
                    username,
                    isVIP: await window.checkVIPStatus(username)
                }));
                const vipResults = await Promise.all(vipPromises);
                vipStatuses = Object.fromEntries(vipResults.map(v => [v.username, v.isVIP]));
            }
            
            // Build profiles for uncached usernames
            uncachedUsernames.forEach(username => {
                const dbProfile = profileMap.get(username);
                const profile = {
                    color: dbProfile?.name_color || '#ffffff',
                    image: dbProfile?.profile_picture || null,
                    isVIP: vipStatuses[username] || false
                };
                
                // Cache the profile
                profileCache.set(username, {
                    profile,
                    timestamp: now
                });
                
                result[username] = profile;
            });
            
        } catch (err) {
            console.error('Failed to get bulk user profiles:', err);
            // Fallback: default profiles for failed usernames
            uncachedUsernames.forEach(username => {
                const profile = { color: '#ffffff', image: null, isVIP: false };
                profileCache.set(username, { profile, timestamp: now });
                result[username] = profile;
            });
        }
    }
    
    return result;
}

// Clear profile cache for a specific user (for real-time updates)
function invalidateProfileCache(username) {
    profileCache.delete(username);
}

// Clear all cached profiles
function clearProfileCache() {
    profileCache.clear();
}

// Load profile data from Supabase
async function loadProfile() {
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
            console.error('Error loading profile:', error);
        }
        
        if (data) {
            console.log('Loaded profile data:', data);
            // Load profile image
            if (data.profile_picture) {
                const img = document.getElementById('profile-image');
                const placeholder = document.getElementById('profile-image-placeholder');
                const removeBtn = document.getElementById('remove-image-btn');
                
                img.src = data.profile_picture;
                img.style.display = 'block';
                placeholder.style.display = 'none';
                removeBtn.style.display = 'inline-block';
            }
            
            // Load selected color
            if (data.name_color) {
                selectedColor = data.name_color;
                document.getElementById('custom-color').value = data.name_color;
                
                // Update color selection UI
                document.querySelectorAll('.color-option').forEach(option => {
                    if (option.dataset.color === data.name_color) {
                        option.classList.add('selected');
                    } else {
                        option.classList.remove('selected');
                    }
                });
            }
        }
    } catch (err) {
        console.error('Failed to load profile from Supabase:', err);
        // Fallback to localStorage
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
}

// Save profile data to Supabase
async function saveProfile() {
    const username = window.currentUser || localStorage.getItem('msg_username');
    if (!username) {
        alert('Please set a username first!');
        return;
    }
    
    console.log('Starting profile save for username:', username);
    
    const img = document.getElementById('profile-image');
    const profileData = {
        username: username,
        profile_picture: img.style.display !== 'none' ? img.src : null,
        name_color: selectedColor
    };
    
    console.log('Profile data to save:', profileData);
    
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
            console.log('Updating existing profile...');
            result = await window.supabaseClient
                .from('profile_items')
                .update({
                    profile_picture: profileData.profile_picture,
                    name_color: profileData.name_color
                })
                .eq('username', username)
                .select();
        } else {
            // Insert new profile
            console.log('Inserting new profile...');
            result = await window.supabaseClient
                .from('profile_items')
                .insert([profileData])
                .select();
        }
        
        console.log('Save result:', result);
        
        if (result.error) {
            console.error('Error saving profile:', result.error);
            alert('Failed to save profile: ' + result.error.message);
        } else {
            // Invalidate cache for this user to force refresh
            invalidateProfileCache(username);
            
            // Also save to localStorage as backup
            localStorage.setItem(PROFILE_KEY, JSON.stringify({
                image: profileData.profile_picture,
                color: profileData.name_color
            }));
            console.log('Profile saved successfully!');
            alert('Profile saved successfully!');
        }
    } catch (err) {
        console.error('Failed to save profile to Supabase:', err);
        alert('Failed to save profile: ' + err.message);
    }
}

// Get user profile from Supabase (optimized with cache)
async function getUserProfile(username) {
    if (!username) return { color: '#ffffff' };
    
    // Check cache first
    const cached = profileCache.get(username);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < PROFILE_CACHE_DURATION) {
        return cached.profile;
    }
    
    try {
        // Load from database if not cached
        const { data, error } = await window.supabaseClient
            .from('profile_items')
            .select('*')
            .eq('username', username)
            .maybeSingle();
        
        if (error) {
            console.error('Error getting user profile:', error);
        }
        
        const profileData = {
            color: data?.name_color || '#ffffff',
            image: data?.profile_picture || null
        };
        
        // Check VIP status
        if (window.checkVIPStatus) {
            profileData.isVIP = await window.checkVIPStatus(username);
        }
        
        // Cache the result
        profileCache.set(username, {
            profile: profileData,
            timestamp: now
        });
        
        return profileData;
    } catch (err) {
        console.error('Failed to get user profile:', err);
        // Fallback to localStorage for current user
        if (username === (window.currentUser || localStorage.getItem('msg_username'))) {
            const profile = localStorage.getItem(PROFILE_KEY);
            const profileData = profile ? JSON.parse(profile) : { color: '#ffffff' };
            
            // Check VIP status
            if (window.checkVIPStatus) {
                profileData.isVIP = await window.checkVIPStatus(username);
            }
            
            // Cache the fallback result
            profileCache.set(username, {
                profile: profileData,
                timestamp: now
            });
            
            return profileData;
        }
        
        // Default profile for unknown users
        const defaultProfile = { color: '#ffffff', image: null, isVIP: false };
        profileCache.set(username, {
            profile: defaultProfile,
            timestamp: now
        });
        
        return defaultProfile;
    }
}

// Initialize profile functionality
async function initProfile() {
    const profileBtn = document.getElementById('profile-btn');
    const profileScreen = document.getElementById('profile-screen');
    const saveBtn = document.getElementById('save-profile-btn');
    const imageContainer = document.getElementById('profile-image-container');
    const imageInput = document.getElementById('profile-image-input');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const colorOptions = document.querySelectorAll('.color-option');
    const customColorInput = document.getElementById('custom-color');
    const vipColorsSection = document.getElementById('vip-colors-section');
    
    // Check VIP status
    const username = window.currentUser || localStorage.getItem('msg_username');
    if (username && window.checkVIPStatus) {
        const isVIP = await window.checkVIPStatus(username);
        if (isVIP && vipColorsSection) {
            vipColorsSection.style.display = 'block';
        }
    }
    
    // Profile button click
    if (profileBtn) {
        profileBtn.addEventListener('click', async () => {
            showScreen(profileScreen);
            loadProfile();
            
            // Check VIP status again when opening profile
            if (username && window.checkVIPStatus) {
                const isVIP = await window.checkVIPStatus(username);
                if (isVIP && vipColorsSection) {
                    vipColorsSection.style.display = 'block';
                }
            }
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
window.getUserProfilesBulk = getUserProfilesBulk;
window.invalidateProfileCache = invalidateProfileCache;
window.clearProfileCache = clearProfileCache; 