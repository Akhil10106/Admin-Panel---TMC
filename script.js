// Note: Ensure Firebase SDK is included via <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js"></script>
// and other required modules (e.g., firebase-auth, firebase-database)

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBJmnErOKgB5Pp45A00A1J_agJQFSPAyjY",
    authDomain: "edutech-a9b19.firebaseapp.com",
    databaseURL: "https://edutech-a9b19-default-rtdb.firebaseio.com",
    projectId: "edutech-a9b19",
    storageBucket: "edutech-a9b19.firebasestorage.app",
    messagingSenderId: "436628237784",
    appId: "1:436628237784:web:0683a574cdb0b9401616ad",
    measurementId: "G-FK8CSTSW64"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
} catch (error) {
    console.error('Firebase initialization failed:', error);
    alert('Failed to initialize application. Please try again later.');
}

const auth = firebase.auth();
const db = firebase.database();

// Valid plan types and their amounts (for fallback and approval)
const PLAN_AMOUNTS = {
    'Core Monthly': 1000,
    'Core Yearly': 9000,
    'Pro Monthly': 2000,
    'Pro Yearly': 18000,
    'Elite Monthly': 3000,
    'Elite Yearly': 27000
};

const VALID_PLANS = Object.keys(PLAN_AMOUNTS);

// DOM Elements
const sections = document.querySelectorAll('.content-section');
const navLinks = document.querySelectorAll('.nav-link');
const userTableBody = document.getElementById('user-table-body');
const paymentTableBody = document.getElementById('payment-table-body');
const subscriptionTableBody = document.getElementById('subscription-table-body');
const revenueTableBody = document.getElementById('revenue-table-body');
const recentActivity = document.getElementById('recent-activity');
const adminNameElement = document.getElementById('admin-name');
const revenueFilter = document.getElementById('revenue-filter');

// Show Section
function showSection(sectionId) {
    sections.forEach(section => section.style.display = 'none');
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }
    navLinks.forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        showSection(section);
    });
});

// Redirect to Users Section
function redirectToUsers() {
    showSection('users');
}

// Load Profile Data
function loadProfile(user, userData) {
    const profileName = document.getElementById('profile-name');
    const profileRole = document.getElementById('profile-role');
    const profileEmail = document.getElementById('profile-email');
    const profilePhone = document.getElementById('profile-phone');
    const profileLastLogin = document.getElementById('profile-last-login');
    const profileCreated = document.getElementById('profile-created');
    const profileSubscription = document.getElementById('profile-subscription');

    if (profileName) profileName.textContent = userData.name || 'Admin User';
    if (profileRole) profileRole.textContent = userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'Admin';
    if (profileEmail) profileEmail.textContent = userData.email || user.email || 'N/A';
    if (profilePhone) profilePhone.textContent = userData.phone || 'Not provided';
    if (profileLastLogin) profileLastLogin.textContent = userData.lastLogin ? new Date(userData.lastLogin).toLocaleString() : 'N/A';
    if (profileCreated) profileCreated.textContent = user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleString() : 'N/A';
    if (profileSubscription) profileSubscription.textContent = userData.subscription_plan || 'N/A';
}

// Authentication Check
auth.onAuthStateChanged(user => {
    if (user) {
        db.ref('users/' + user.uid).once('value').then(snapshot => {
            const userData = snapshot.val();
            if (userData && userData.role === 'admin') {
                if (adminNameElement) {
                    adminNameElement.textContent = userData.name || 'Admin';
                }
                loadProfile(user, userData);
                loadDashboard();
                loadUsers();
                loadPayments();
                loadSubscriptions();
                loadRevenue();

                // Update last login
                db.ref('users/' + user.uid).update({
                    lastLogin: Date.now()
                }).catch(error => {
                    console.error('Error updating last login:', error);
                });
            } else {
                alert('Access denied. Admin setup failed.');
                auth.signOut().then(() => {
                    window.location.href = '/login.html';
                });
            }
        }).catch(error => {
            console.error('Error fetching user data:', error);
            alert('Failed to verify user data. Error: ' + error.message);
            auth.signOut().then(() => {
                window.location.href = '/login.html';
            });
        });
    } else {
        window.location.href = '/login.html';
    }
});

// Change Admin Credentials
async function changeAdminCredentials() {
    const newEmail = document.getElementById('new-admin-email')?.value.trim();
    const newPassword = document.getElementById('new-admin-password')?.value;

    if (!newEmail && !newPassword) {
        alert('Please enter a new email or password.');
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert('No user is currently logged in.');
        return;
    }

    try {
        const promises = [];
        if (newEmail) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
                throw new Error('Invalid email format.');
            }
            await user.updateEmail(newEmail);
            promises.push(db.ref('users/' + user.uid).update({ email: newEmail }));
        }
        if (newPassword) {
            if (newPassword.length < 6) {
                throw new Error('Password must be at least 6 characters.');
            }
            promises.push(user.updatePassword(newPassword));
        }
        await Promise.all(promises);
        alert('Admin credentials updated successfully.');
        if (document.getElementById('new-admin-email')) document.getElementById('new-admin-email').value = '';
        if (document.getElementById('new-admin-password')) document.getElementById('new-admin-password').value = '';
    } catch (error) {
        console.error('Error updating admin credentials:', error);
        alert('Failed to update credentials: ' + error.message);
    }
}

// Log Activity
function logActivity(userEmail, action) {
    db.ref('activity').push({
        user: userEmail,
        action: action,
        timestamp: Date.now()
    }).catch(error => {
        console.error('Error logging activity:', error);
    });
}

// Load Dashboard Data
async function loadDashboard() {
    try {
        // Total Users
        const userSnapshot = await db.ref('users').once('value');
        if (document.getElementById('total-users')) {
            document.getElementById('total-users').textContent = userSnapshot.numChildren() || 0;
        }

        // Active Subscriptions
        let activeSubs = 0;
        userSnapshot.forEach(child => {
            const user = child.val();
            if (user.subscription_status && user.subscription_expiry > Date.now()) {
                activeSubs++;
            }
        });
        if (document.getElementById('active-subs')) {
            document.getElementById('active-subs').textContent = activeSubs;
        }

        // Pending Payments
        const paymentSnapshot = await db.ref('pending_payments').once('value');
        if (document.getElementById('pending-payments')) {
            document.getElementById('pending-payments').textContent = paymentSnapshot.numChildren() || 0;
        }

        // Revenue (This Month)
        let totalRevenue = 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        userSnapshot.forEach(child => {
            const user = child.val();
            if (
                user.subscription_status &&
                user.subscription_expiry > Date.now() &&
                user.subscription_amount &&
                user.subscription_start
            ) {
                const startDate = new Date(user.subscription_start);
                if (!isNaN(startDate) && startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear) {
                    totalRevenue += parseFloat(user.subscription_amount) || 0;
                }
            }
        });
        if (document.getElementById('revenue')) {
            document.getElementById('revenue').textContent = `₹${totalRevenue.toFixed(2)}`;
        }

        // Recent Activity
        const activitySnapshot = await db.ref('activity').orderByChild('timestamp').limitToLast(5).once('value');
        if (recentActivity) {
            recentActivity.innerHTML = '';
            if (activitySnapshot.exists()) {
                activitySnapshot.forEach(child => {
                    const activity = child.val();
                    const li = document.createElement('li');
                    li.textContent = `${activity.user} ${activity.action} at ${new Date(activity.timestamp).toLocaleString()}`;
                    recentActivity.appendChild(li);
                });
            } else {
                recentActivity.innerHTML = '<li>No recent activity.</li>';
            }
        }

        // Subscription Chart (Note: Hardcoded data, consider fetching from DB for production)
        if (window.Chart && document.getElementById('subscription-chart')) {
            try {
                const ctx = document.getElementById('subscription-chart').getContext('2d');
                if (!ctx) throw new Error('Chart canvas context not found');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                        datasets: [{
                            label: 'Subscriptions',
                            data: [50, 75, 100, 120, 150],
                            borderColor: '#2e71cc',
                            fill: false
                        }]
                    },
                    options: { responsive: true }
                });
            } catch (error) {
                console.error('Error initializing chart:', error);
            }
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        if (document.getElementById('total-users')) document.getElementById('total-users').textContent = 'N/A';
        if (document.getElementById('active-subs')) document.getElementById('active-subs').textContent = 'N/A';
        if (document.getElementById('pending-payments')) document.getElementById('pending-payments').textContent = 'N/A';
        if (document.getElementById('revenue')) document.getElementById('revenue').textContent = '₹0';
        if (recentActivity) recentActivity.innerHTML = '<li>Error loading activity.</li>';
    }
}

// Load Users
function loadUsers() {
    db.ref('users').on('value', snapshot => {
        if (userTableBody) {
            userTableBody.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const user = child.val();
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${user.name || 'N/A'}</td>
                        <td>${user.email || 'N/A'}</td>
                        <td>${user.role || 'user'}</td>
                        <td>${user.subscription_status ? 'Active' : 'Inactive'}</td>
                        <td>
                            <button onclick="editUser('${child.key}')">Edit</button>
                            <button onclick="deleteUser('${child.key}')">Delete</button>
                        </td>
                    `;
                    userTableBody.appendChild(row);
                });
            } else {
                userTableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
            }
        }
    }, error => {
        console.error('Error loading users:', error);
        if (userTableBody) {
            userTableBody.innerHTML = '<tr><td colspan="5">Error loading users.</td></tr>';
        }
    });
}

// Load Payments
async function loadPayments() {
    try {
        db.ref('pending_payments').on('value', async snapshot => {
            if (paymentTableBody) {
                paymentTableBody.innerHTML = '';
                if (snapshot.exists()) {
                    const paymentPromises = [];
                    snapshot.forEach(child => {
                        const payment = child.val();
                        const userId = child.key;
                        paymentPromises.push(
                            db.ref('users/' + userId).once('value').then(userSnapshot => {
                                const user = userSnapshot.val() || {};
                                const plan = payment.plan && typeof payment.plan === 'string' && VALID_PLANS.includes(payment.plan) ? payment.plan : 'Unknown Plan';
                                const amount = payment.amount && !isNaN(payment.amount) ? payment.amount : (PLAN_AMOUNTS[plan] || 0);
                                return `
                                    <tr>
                                        <td>${user.name || 'N/A'}</td>
                                        <td>${plan}</td>
                                        <td>₹${amount}</td>
                                        <td>${payment.unique_id || 'N/A'}</td>
                                        <td>${payment.status || 'Pending'}</td>
                                        <td>
                                            <button onclick="approvePayment('${userId}')">Approve</button>
                                            <button onclick="rejectPayment('${userId}')">Reject</button>
                                        </td>
                                    </tr>
                                `;
                            }).catch(error => {
                                console.error(`Error fetching user ${userId} for payment:`, error);
                                return '';
                            })
                        );
                    });
                    const rows = await Promise.all(paymentPromises);
                    paymentTableBody.innerHTML = rows.join('') || '<tr><td colspan="6">No valid payments found.</td></tr>';
                } else {
                    paymentTableBody.innerHTML = '<tr><td colspan="6">No payments found.</td></tr>';
                }
            }
        });
    } catch (error) {
        console.error('Error loading payments:', error);
        if (paymentTableBody) {
            paymentTableBody.innerHTML = '<tr><td colspan="6">Error loading payments.</td></tr>';
        }
    }
}

// Load Subscriptions
function loadSubscriptions() {
    db.ref('users').on('value', snapshot => {
        if (subscriptionTableBody) {
            subscriptionTableBody.innerHTML = '';
            if (snapshot.exists()) {
                let hasActiveSubscriptions = false;
                snapshot.forEach(child => {
                    const user = child.val();
                    if (user.subscription_status && user.subscription_expiry > Date.now()) {
                        hasActiveSubscriptions = true;
                        const startDate = user.subscription_start ? new Date(user.subscription_start).toLocaleDateString() : 'N/A';
                        const expiryDate = user.subscription_expiry ? new Date(user.subscription_expiry).toLocaleDateString() : 'N/A';
                        const timeLeftMs = user.subscription_expiry - Date.now();
                        const daysLeft = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
                        const hoursLeft = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const timeLeft = `${daysLeft} days, ${hoursLeft} hours`;
                        const plan = VALID_PLANS.includes(user.subscription_plan) ? user.subscription_plan : user.subscription_plan || 'Core Monthly';

                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${user.name || 'N/A'}</td>
                            <td>${user.email || 'N/A'}</td>
                            <td>${plan}</td>
                            <td>${startDate}</td>
                            <td>${expiryDate}</td>
                            <td>${timeLeft}</td>
                        `;
                        subscriptionTableBody.appendChild(row);
                    }
                });
                if (!hasActiveSubscriptions) {
                    subscriptionTableBody.innerHTML = '<tr><td colspan="6">No active subscriptions found.</td></tr>';
                }
            } else {
                subscriptionTableBody.innerHTML = '<tr><td colspan="6">No users found.</td></tr>';
            }
        }
    }, error => {
        console.error('Error loading subscriptions:', error);
        if (subscriptionTableBody) {
            subscriptionTableBody.innerHTML = '<tr><td colspan="6">Error loading subscriptions.</td></tr>';
        }
    });
}

// Load Revenue
async function loadRevenue() {
    const filter = revenueFilter?.value || 'all-active';
    try {
        const snapshot = await db.ref('users').once('value');
        if (revenueTableBody) {
            revenueTableBody.innerHTML = '';
            let totalRevenue = 0;
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            let hasActiveSubscriptions = false;

            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const user = child.val();
                    const userId = child.key;
                    if (user.subscription_status && user.subscription_expiry > Date.now()) {
                        hasActiveSubscriptions = true;
                        const startDate = user.subscription_start ? new Date(user.subscription_start) : null;
                        const plan = VALID_PLANS.includes(user.subscription_plan) ? user.subscription_plan : user.subscription_plan || 'Core Monthly';
                        const amount = user.subscription_amount && !isNaN(user.subscription_amount) ? user.subscription_amount : (PLAN_AMOUNTS[plan] || 0);

                        let includeInTable = false;
                        if (filter === 'all-active') {
                            includeInTable = true;
                            totalRevenue += parseFloat(amount) || 0;
                        } else if (filter === 'this-month' && startDate && !isNaN(startDate) && startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear) {
                            includeInTable = true;
                            totalRevenue += parseFloat(amount) || 0;
                        }

                        if (includeInTable) {
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${user.name || 'N/A'}</td>
                                <td>${user.email || 'N/A'}</td>
                                <td>${plan}</td>
                                <td>₹${amount}</td>
                                <td>${startDate ? startDate.toLocaleDateString() : 'N/A'}</td>
                            `;
                            revenueTableBody.appendChild(row);
                        }
                    }
                });

                if (!hasActiveSubscriptions) {
                    revenueTableBody.innerHTML = '<tr><td colspan="5">No active subscriptions found.</td></tr>';
                } else if (revenueTableBody.innerHTML === '') {
                    revenueTableBody.innerHTML = `<tr><td colspan="5">No subscriptions match the filter "${filter === 'this-month' ? 'This Month' : 'All Active'}".</td></tr>`;
                }

                if (document.getElementById('total-revenue')) {
                    document.getElementById('total-revenue').textContent = `₹${totalRevenue.toFixed(2)}`;
                }
            } else {
                revenueTableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
                if (document.getElementById('total-revenue')) {
                    document.getElementById('total-revenue').textContent = '₹0';
                }
            }
        }
    } catch (error) {
        console.error('Error loading revenue:', error);
        if (revenueTableBody) {
            revenueTableBody.innerHTML = `<tr><td colspan="5">Error loading revenue: ${error.message}</td></tr>`;
        }
        if (document.getElementById('total-revenue')) {
            document.getElementById('total-revenue').textContent = '₹0';
        }
    }
}

// Add Revenue Filter Event Listener
if (revenueFilter) {
    revenueFilter.addEventListener('change', () => {
        loadRevenue();
    });
}

// Add User
async function addUser() {
    const userNameInput = document.getElementById('user-name');
    const userEmailInput = document.getElementById('user-email');
    const userRoleInput = document.getElementById('user-role');

    if (!userNameInput || !userEmailInput || !userRoleInput) {
        alert('Form elements not found.');
        return;
    }

    const name = userNameInput.value.trim();
    const email = userEmailInput.value.trim();
    const role = userRoleInput.value;

    if (!name || !email || !role) {
        alert('Please fill all fields.');
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Invalid email format.');
        return;
    }

    try {
        const userId = db.ref('users').push().key;
        await db.ref('users/' + userId).set({
            id: userId,
            name,
            email,
            role,
            subscription_status: false,
            trial_used: false
        });
        closeModal('add-user-modal');
        alert('User added successfully.');
        logActivity(email, 'added as new user');
    } catch (error) {
        console.error('Error adding user:', error);
        alert('Error adding user: ' + error.message);
    }
}

// Edit User (Placeholder)
function editUser(userId) {
    alert('Edit user functionality to be implemented.');
}

// Delete User
async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        try {
            const snapshot = await db.ref('users/' + userId).once('value');
            const user = snapshot.val();
            await db.ref('users/' + userId).remove();
            alert('User deleted successfully.');
            logActivity(user.email, 'deleted');
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Error deleting user: ' + error.message);
        }
    }
}

// Approve Payment
async function approvePayment(userId) {
    try {
        const snapshot = await db.ref('pending_payments/' + userId).once('value');
        const payment = snapshot.val();
        if (payment) {
            const plan = VALID_PLANS.includes(payment.plan) ? payment.plan : payment.plan || 'Core Monthly';
            const amount = payment.amount && !isNaN(payment.amount) ? payment.amount : (PLAN_AMOUNTS[plan] || 1000);
            const approvalTime = Date.now();
            const isYearly = plan.includes('Yearly');
            const expiryDuration = isYearly ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;

            await db.ref('users/' + userId).update({
                subscription_status: true,
                subscription_expiry: approvalTime + expiryDuration,
                subscription_plan: plan,
                subscription_start: approvalTime,
                subscription_amount: amount
            });
            await db.ref('pending_payments/' + userId).remove();

            const userSnapshot = await db.ref('users/' + userId).once('value');
            const user = userSnapshot.val();
            alert('Payment approved and user updated.');
            logActivity(user.email, `payment approved for ${plan} (₹${amount})`);
        } else {
            alert('Payment not found.');
        }
    } catch (error) {
        console.error('Error approving payment:', error);
        alert('Error approving payment: ' + error.message);
    }
}

// Reject Payment
async function rejectPayment(userId) {
    try {
        await db.ref('users/' + userId).update({
            subscription_status: false
        });
        await db.ref('pending_payments/' + userId).remove();

        const userSnapshot = await db.ref('users/' + userId).once('value');
        const user = userSnapshot.val();
        alert('Payment rejected and user updated.');
        logActivity(user.email, 'payment rejected');
    } catch (error) {
        console.error('Error rejecting payment:', error);
        alert('Error rejecting payment: ' + error.message);
    }
}

// Save Settings
async function saveSettings() {
    const trialDurationInput = document.getElementById('trial-duration');
    const mfaEnabledInput = document.getElementById('mfa-enabled');

    if (!trialDurationInput || !mfaEnabledInput) {
        alert('Settings form elements not found.');
        return;
    }

    const trialDuration = trialDurationInput.value;
    const mfaEnabled = mfaEnabledInput.checked;

    if (!trialDuration || isNaN(trialDuration) || parseInt(trialDuration) <= 0) {
        alert('Please enter a valid positive trial duration.');
        return;
    }

    try {
        await db.ref('settings').set({
            trial_duration: parseInt(trialDuration),
            mfa_enabled: mfaEnabled
        });
        alert('Settings saved successfully.');
        logActivity('Admin', 'settings updated');
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Error saving settings: ' + error.message);
    }
}

// Edit Profile
async function editProfile() {
    const user = auth.currentUser;
    if (!user) {
        alert('No user is currently logged in.');
        return;
    }

    try {
        const snapshot = await db.ref('users/' + user.uid).once('value');
        const userData = snapshot.val();
        const editNameInput = document.getElementById('edit-name');
        const editPhoneInput = document.getElementById('edit-phone');
        const editProfileModal = document.getElementById('edit-profile-modal');

        if (editNameInput && editPhoneInput && editProfileModal) {
            editNameInput.value = userData.name || '';
            editPhoneInput.value = userData.phone || '';
            editProfileModal.style.display = 'flex';
        } else {
            alert('Profile form elements not found.');
        }
    } catch (error) {
        console.error('Error loading profile data:', error);
        alert('Error loading profile data: ' + error.message);
    }
}

// Save Profile
async function saveProfile() {
    const name = document.getElementById('edit-name')?.value.trim();
    const phone = document.getElementById('edit-phone')?.value.trim();
    const user = auth.currentUser;

    if (!user) {
        alert('No user is currently logged in.');
        return;
    }

    if (!name) {
        alert('Name is required.');
        return;
    }

    try {
        await db.ref('users/' + user.uid).update({
            name,
            phone: phone || null
        });
        closeModal('edit-profile-modal');
        alert('Profile updated successfully.');
        logActivity(user.email, 'profile updated');
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile: ' + error.message);
    }
}

// Modal Controls
function showAddUserModal() {
    const modal = document.getElementById('add-user-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Logout
async function handleLogout() {
    try {
        await auth.signOut();
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        alert('Error logging out: ' + error.message);
    }
}

// Initialize
showSection('dashboard');
