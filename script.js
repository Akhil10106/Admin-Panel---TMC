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

// Show Section
function showSection(sectionId) {
    sections.forEach(section => section.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';
    navLinks.forEach(link => link.classList.remove('active'));
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
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

    profileName.textContent = userData.name || 'Admin User';
    profileRole.textContent = userData.role.charAt(0).toUpperCase() + userData.role.slice(1) || 'Admin';
    profileEmail.textContent = userData.email || user.email || 'N/A';
    profilePhone.textContent = userData.phone || 'Not provided';
    profileLastLogin.textContent = userData.lastLogin ? new Date(userData.lastLogin).toLocaleString() : 'N/A';
    profileCreated.textContent = user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleString() : 'N/A';
    profileSubscription.textContent = userData.subscription_plan || 'N/A';
}

// Authentication Check
auth.onAuthStateChanged(user => {
    if (user) {
        console.log('User authenticated:', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
        });
        db.ref('active_session').once('value').then(snapshot => {
            const activeSession = snapshot.val();
            if (activeSession && activeSession.uid !== user.uid) {
                console.log('User not in active session. Signing out:', user.uid);
                alert('Another user has logged in. Signing you out.');
                auth.signOut().then(() => {
                    window.location.href = '/login.html';
                });
                return;
            }

            db.ref('users/' + user.uid).once('value').then(snapshot => {
                const userData = snapshot.val();
                console.log('User data from database:', userData);
                if (userData && userData.role === 'admin') {
                    if (adminNameElement) {
                        adminNameElement.textContent = userData.name || 'Admin';
                    } else {
                        console.warn('adminNameElement not found in DOM');
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
                    console.error('User is not an admin:', { userData, uid: user.uid, email: user.email });
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
        }).catch(error => {
            console.error('Error checking active session:', error);
            alert('Failed to verify session. Error: ' + error.message);
            auth.signOut().then(() => {
                window.location.href = '/login.html';
            });
        });
    } else {
        console.log('No user authenticated. Redirecting to login.');
        window.location.href = '/login.html';
    }
});

// Change Admin Credentials
function changeAdminCredentials() {
    const newEmail = document.getElementById('new-admin-email').value.trim();
    const newPassword = document.getElementById('new-admin-password').value;

    if (!newEmail && !newPassword) {
        alert('Please enter a new email or password.');
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert('No user is currently logged in.');
        return;
    }

    const promises = [];

    if (newEmail) {
        promises.push(
            user.updateEmail(newEmail).then(() => {
                return db.ref('users/' + user.uid).update({ email: newEmail });
            })
        );
    }

    if (newPassword) {
        promises.push(user.updatePassword(newPassword));
    }

    Promise.all(promises).then(() => {
        console.log('Admin credentials updated:', { newEmail, newPassword: newPassword ? '******' : 'unchanged' });
        alert('Admin credentials updated successfully.');
        document.getElementById('new-admin-email').value = '';
        document.getElementById('new-admin-password').value = '';
    }).catch(error => {
        console.error('Error updating admin credentials:', error);
        alert('Failed to update credentials: ' + error.message);
    });
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
function loadDashboard() {
    // Total Users
    db.ref('users').once('value').then(snapshot => {
        document.getElementById('total-users').textContent = snapshot.numChildren() || 0;
    }).catch(error => {
        console.error('Error loading total users:', error);
        document.getElementById('total-users').textContent = 'N/A';
    });

    // Active Subscriptions
    db.ref('users').once('value').then(snapshot => {
        let activeSubs = 0;
        snapshot.forEach(child => {
            const user = child.val();
            if (user.subscription_status && user.subscription_expiry > Date.now()) {
                activeSubs++;
            }
        });
        document.getElementById('active-subs').textContent = activeSubs;
    }).catch(error => {
        console.error('Error loading active subscriptions:', error);
        document.getElementById('active-subs').textContent = 'N/A';
    });

    // Pending Payments
    db.ref('pending_payments').once('value').then(snapshot => {
        document.getElementById('pending-payments').textContent = snapshot.numChildren() || 0;
    }).catch(error => {
        console.error('Error loading pending payments:', error);
        document.getElementById('pending-payments').textContent = 'N/A';
    });

    // Revenue (This Month)
    db.ref('users').once('value').then(snapshot => {
        let totalRevenue = 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        if (snapshot.exists()) {
            snapshot.forEach(child => {
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
        }

        document.getElementById('revenue').textContent = `₹${totalRevenue.toFixed(2)}`;
    }).catch(error => {
        console.error('Error loading revenue:', error);
        document.getElementById('revenue').textContent = '₹0';
    });

    // Recent Activity
    db.ref('activity').orderByChild('timestamp').limitToLast(5).once('value').then(snapshot => {
        recentActivity.innerHTML = '';
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const activity = child.val();
                const li = document.createElement('li');
                li.textContent = `${activity.user} ${activity.action} at ${new Date(activity.timestamp).toLocaleString()}`;
                recentActivity.appendChild(li);
            });
        } else {
            recentActivity.innerHTML = '<li>No recent activity.</li>';
        }
    }).catch(error => {
        console.error('Error loading recent activity:', error);
        recentActivity.innerHTML = '<li>Error loading activity.</li>';
    });

    // Subscription Chart
    try {
        if (!window.Chart) {
            throw new Error('Chart.js not loaded');
        }
        const ctx = document.getElementById('subscription-chart').getContext('2d');
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

// Load Users
function loadUsers() {
    db.ref('users').on('value', snapshot => {
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
    }, error => {
        console.error('Error loading users:', error);
        userTableBody.innerHTML = '<tr><td colspan="5">Error loading users.</td></tr>';
    });
}

// Load Payments
function loadPayments() {
    db.ref('pending_payments').on('value', snapshot => {
        paymentTableBody.innerHTML = '';
        if (snapshot.exists()) {
            const paymentPromises = [];
            snapshot.forEach(child => {
                const payment = child.val();
                const userId = child.key;
                console.log(`Loading payment for user ${userId}:`, payment);
                paymentPromises.push(
                    db.ref('users/' + userId).once('value').then(userSnapshot => {
                        const user = userSnapshot.val() || {};
                        const plan = payment.plan && typeof payment.plan === 'string' ? payment.plan : 'Unknown Plan';
                        const amount = payment.amount && !isNaN(payment.amount) ? payment.amount : (PLAN_AMOUNTS[plan] || 0);
                        if (!payment.plan) {
                            console.warn(`Missing plan for user ${userId}, defaulting to 'Unknown Plan'`);
                        }
                        if (!payment.amount || isNaN(payment.amount)) {
                            console.warn(`Missing or invalid amount for user ${userId}, defaulting to ₹${amount}`);
                        }
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
            Promise.all(paymentPromises).then(rows => {
                paymentTableBody.innerHTML = rows.join('');
                if (!rows.some(row => row)) {
                    paymentTableBody.innerHTML = '<tr><td colspan="6">No valid payments found.</td></tr>';
                }
            }).catch(error => {
                console.error('Error processing payments:', error);
                paymentTableBody.innerHTML = '<tr><td colspan="6">Error loading payments.</td></tr>';
            });
        } else {
            paymentTableBody.innerHTML = '<tr><td colspan="6">No payments found.</td></tr>';
        }
    }, error => {
        console.error('Error loading payments:', error);
        paymentTableBody.innerHTML = '<tr><td colspan="6">Error loading payments.</td></tr>';
    });
}

// Load Subscriptions
function loadSubscriptions() {
    db.ref('users').on('value', snapshot => {
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
    }, error => {
        console.error('Error loading subscriptions:', error);
        subscriptionTableBody.innerHTML = '<tr><td colspan="6">Error loading subscriptions.</td></tr>';
    });
}

// Load Revenue
function loadRevenue() {
    const filter = document.getElementById('revenue-filter')?.value || 'all-active';
    console.log(`Loading revenue with filter: ${filter}`);

    db.ref('users').once('value').then(snapshot => {
        console.log('Users snapshot:', snapshot.val());
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
                console.log(`Checking user ${userId}:`, user);

                if (user.subscription_status && user.subscription_expiry > Date.now()) {
                    hasActiveSubscriptions = true;
                    const startDate = user.subscription_start ? new Date(user.subscription_start) : null;
                    const plan = VALID_PLANS.includes(user.subscription_plan) ? user.subscription_plan : user.subscription_plan || 'Core Monthly';
                    const amount = user.subscription_amount && !isNaN(user.subscription_amount) ? user.subscription_amount : (PLAN_AMOUNTS[plan] || 0);

                    if (!user.subscription_amount) {
                        console.warn(`Missing subscription_amount for user ${userId}, defaulting to ₹${amount}`);
                    }
                    if (!user.subscription_plan) {
                        console.warn(`Missing subscription_plan for user ${userId}, defaulting to ${plan}`);
                    }
                    if (!user.subscription_start) {
                        console.warn(`Missing subscription_start for user ${userId}, excluding from this-month filter`);
                    }
                    if (user.subscription_start && isNaN(startDate)) {
                        console.warn(`Invalid subscription_start for user ${userId}: ${user.subscription_start}, excluding from this-month filter`);
                    }

                    // Include based on filter
                    let includeInTable = false;
                    if (filter === 'all-active') {
                        includeInTable = true;
                        totalRevenue += parseFloat(amount) || 0;
                    } else if (filter === 'this-month' && startDate && !isNaN(startDate) && startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear) {
                        includeInTable = true;
                        totalRevenue += parseFloat(amount) || 0;
                    }

                    if (includeInTable) {
                        console.log(`Including user ${userId} in revenue table: Plan=${plan}, Amount=₹${amount}, Start=${startDate ? startDate.toLocaleDateString() : 'N/A'}`);
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${user.name || 'N/A'}</td>
                            <td>${user.email || 'N/A'}</td>
                            <td>${plan}</td>
                            <td>₹${amount}</td>
                            <td>${startDate ? startDate.toLocaleDateString() : 'N/A'}</td>
                        `;
                        revenueTableBody.appendChild(row);
                    } else {
                        console.log(`Excluding user ${userId}: Filter=${filter}, Start=${startDate ? startDate.toLocaleDateString() : 'N/A'}`);
                    }
                } else {
                    console.log(`Excluding user ${userId}: subscription_status=${user.subscription_status}, expiry=${user.subscription_expiry}, now=${Date.now()}`);
                }
            });

            if (!hasActiveSubscriptions) {
                revenueTableBody.innerHTML = '<tr><td colspan="5">No active subscriptions found.</td></tr>';
            } else if (revenueTableBody.innerHTML === '') {
                revenueTableBody.innerHTML = `<tr><td colspan="5">No subscriptions match the filter "${filter === 'this-month' ? 'This Month' : 'All Active'}".</td></tr>`;
            }

            document.getElementById('total-revenue').textContent = `₹${totalRevenue.toFixed(2)}`;
        } else {
            revenueTableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
            document.getElementById('total-revenue').textContent = '₹0';
        }
    }).catch(error => {
        console.error('Error loading revenue:', error);
        revenueTableBody.innerHTML = `<tr><td colspan="5">Error loading revenue: ${error.message}</td></tr>`;
        document.getElementById('total-revenue').textContent = '₹0';
    });
}

// Add User
function addUser() {
    const name = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const role = document.getElementById('user-role').value;

    if (!name || !email || !role) {
        alert('Please fill all fields.');
        return;
    }

    const userId = db.ref('users').push().key;
    db.ref('users/' + userId).set({
        id: userId,
        name,
        email,
        role,
        subscription_status: false,
        trial_used: false
    }).then(() => {
        closeModal('add-user-modal');
        alert('User added successfully.');
        logActivity(email, 'added as new user');
    }).catch(error => {
        console.error('Error adding user:', error);
        alert('Error adding user: ' + error.message);
    });
}

// Edit User (Placeholder)
function editUser(userId) {
    alert('Edit user functionality to be implemented.');
}

// Delete User
function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        db.ref('users/' + userId).once('value', snapshot => {
            const user = snapshot.val();
            db.ref('users/' + userId).remove().then(() => {
                alert('User deleted successfully.');
                logActivity(user.email, 'deleted');
            }).catch(error => {
                console.error('Error deleting user:', error);
                alert('Error deleting user: ' + error.message);
            });
        }).catch(error => {
            console.error('Error fetching user for deletion:', error);
            alert('Error deleting user: ' + error.message);
        });
    }
}

// Approve Payment
function approvePayment(userId) {
    db.ref('pending_payments/' + userId).once('value').then(snapshot => {
        const payment = snapshot.val();
        if (payment) {
            console.log(`Approving payment for user ${userId}:`, payment);
            const plan = VALID_PLANS.includes(payment.plan) ? payment.plan : payment.plan || 'Core Monthly';
            const amount = payment.amount && !isNaN(payment.amount) ? payment.amount : (PLAN_AMOUNTS[plan] || 1000);
            const approvalTime = Date.now();
            const isYearly = plan.includes('Yearly');
            const expiryDuration = isYearly ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000; // 1 year or 30 days

            db.ref('users/' + userId).update({
                subscription_status: true,
                subscription_expiry: approvalTime + expiryDuration,
                subscription_plan: plan,
                subscription_start: approvalTime,
                subscription_amount: amount
            }).then(() => {
                db.ref('pending_payments/' + userId).remove().then(() => {
                    alert('Payment approved and user updated.');
                    db.ref('users/' + userId).once('value').then(userSnapshot => {
                        const user = userSnapshot.val();
                        logActivity(user.email, `payment approved for ${plan} (₹${amount})`);
                    }).catch(error => {
                        console.error('Error fetching user after payment approval:', error);
                    });
                }).catch(error => {
                    console.error('Error removing pending payment:', error);
                    alert('Error approving payment: ' + error.message);
                });
            }).catch(error => {
                console.error('Error updating user for payment approval:', error);
                alert('Error approving payment: ' + error.message);
            });
        } else {
            alert('Payment not found.');
        }
    }).catch(error => {
        console.error('Error fetching payment:', error);
        alert('Error fetching payment: ' + error.message);
    });
}

// Reject Payment
function rejectPayment(userId) {
    db.ref('users/' + userId).update({
        subscription_status: false
    }).then(() => {
        db.ref('pending_payments/' + userId).remove().then(() => {
            alert('Payment rejected and user updated.');
            db.ref('users/' + userId).once('value').then(userSnapshot => {
                const user = userSnapshot.val();
                logActivity(user.email, 'payment rejected');
            }).catch(error => {
                console.error('Error fetching user after payment rejection:', error);
            });
        }).catch(error => {
            console.error('Error removing pending payment:', error);
            alert('Error rejecting payment: ' + error.message);
        });
    }).catch(error => {
        console.error('Error updating user for payment rejection:', error);
        alert('Error rejecting payment: ' + error.message);
    });
}

// Save Settings
function saveSettings() {
    const trialDuration = document.getElementById('trial-duration').value;
    const mfaEnabled = document.getElementById('mfa-enabled').checked;

    db.ref('settings').set({
        trial_duration: parseInt(trialDuration),
        mfa_enabled: mfaEnabled
    }).then(() => {
        alert('Settings saved successfully.');
        logActivity('Admin', 'settings updated');
    }).catch(error => {
        console.error('Error saving settings:', error);
        alert('Error saving settings: ' + error.message);
    });
}

// Edit Profile
function editProfile() {
    const user = auth.currentUser;
    if (!user) {
        alert('No user is currently logged in.');
        return;
    }

    db.ref('users/' + user.uid).once('value').then(snapshot => {
        const userData = snapshot.val();
        document.getElementById('edit-name').value = userData.name || '';
        document.getElementById('edit-phone').value = userData.phone || '';
        document.getElementById('edit-profile-modal').style.display = 'flex';
    }).catch(error => {
        console.error('Error loading profile data:', error);
        alert('Error loading profile data: ' + error.message);
    });
}

// Save Profile
function saveProfile() {
    const name = document.getElementById('edit-name').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const user = auth.currentUser;

    if (!user) {
        alert('No user is currently logged in.');
        return;
    }

    if (!name) {
        alert('Name is required.');
        return;
    }

    db.ref('users/' + user.uid).update({
        name,
        phone: phone || null
    }).then(() => {
        closeModal('edit-profile-modal');
        alert('Profile updated successfully.');
        logActivity(user.email, 'profile updated');
    }).catch(error => {
        console.error('Error updating profile:', error);
        alert('Error updating profile: ' + error.message);
    });
}

// Modal Controls
function showAddUserModal() {
    document.getElementById('add-user-modal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Logout
function handleLogout() {
    db.ref('active_session').remove().then(() => {
        auth.signOut().then(() => {
            window.location.href = '/login.html';
        }).catch(error => {
            console.error('Error signing out:', error);
            alert('Error logging out: ' + error.message);
        });
    }).catch(error => {
        console.error('Error removing active session:', error);
        alert('Error logging out: ' + error.message);
    });
}

// Initialize
showSection('dashboard');