// Safe imports for web deployment
let PushNotifications, LocalNotifications;

try {
  PushNotifications = require('@capacitor/push-notifications').PushNotifications;
  LocalNotifications = require('@capacitor/local-notifications').LocalNotifications;
} catch (error) {
  console.log('Capacitor plugins not available in web environment');
  // Create mock objects for web
  PushNotifications = {
    checkPermissions: () => Promise.resolve({ receive: 'denied' }),
    requestPermissions: () => Promise.resolve({ receive: 'denied' }),
    register: () => Promise.resolve(),
    addListener: () => ({ remove: () => {} })
  };
  LocalNotifications = {
    requestPermissions: () => Promise.resolve(),
    schedule: () => Promise.resolve()
  };
}

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.isWeb = typeof window !== 'undefined' && !window.Capacitor;
    this.settings = {
      enabled: true,
      newChoresCreated: true,
      choresPendingReview: true,
      newGoalsAdded: true,
      goalsCompleted: true,
    };
  }

  async initialize(userId = null) {
    if (this.isInitialized) return;

    try {
      // Skip initialization in web environment
      if (this.isWeb) {
        console.log('Running in web environment, skipping native notifications');
        this.isInitialized = true;
        return;
      }

      // Load user settings if userId provided
      if (userId) {
        await this.loadUserSettings(userId);
      }

      // Request permissions for push notifications
      const permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== 'granted') {
          console.log('Push notification permission denied');
          return;
        }
      }

      // Register for push notifications
      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
      }

      // Add listeners
      PushNotifications.addListener('registration', token => {
        console.log('Push registration success, token: ' + token.value);
        // You can send this token to your server to target this device
        this.handleRegistration(token.value);
      });

      PushNotifications.addListener('registrationError', err => {
        console.error('Registration error: ', err.error);
      });

      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('Push notification received: ', notification);
        this.handleNotificationReceived(notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', notification => {
        console.log('Push notification action performed: ', notification);
        this.handleNotificationTapped(notification);
      });

      // Request permissions for local notifications
      await LocalNotifications.requestPermissions();

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      this.isInitialized = true; // Mark as initialized even if failed
    }
  }

  async loadUserSettings(userId) {
    try {
      // Import Firebase here to avoid circular dependency
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const settingsDoc = await getDoc(doc(db, 'settings', userId));
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        this.settings = { ...this.settings, ...data.notifications };
        console.log('Loaded notification settings:', this.settings);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  }

  async handleRegistration(token) {
    // Store the token in your database or send to your server
    console.log('Device token:', token);
    localStorage.setItem('fcm_token', token);
  }

  handleNotificationReceived(notification) {
    // Handle incoming notification while app is open
    console.log('Notification received:', notification);
    
    // You could show a toast or update the UI
    // For example, update a notification count badge
  }

  handleNotificationTapped(notification) {
    // Handle when user taps on notification
    console.log('Notification tapped:', notification);
    
    // Navigate to relevant screen based on notification data
    // You could emit an event or call a callback here
  }

  async sendLocalNotification(title, body, data = {}) {
    try {
      // Check if notifications are enabled
      if (!this.settings.enabled) {
        console.log('Notifications disabled, skipping:', title);
        return;
      }

      // Skip in web environment
      if (this.isWeb) {
        console.log('Web notification (would show):', title, body);
        return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title: title,
            body: body,
            id: Date.now(),
            extra: data,
            schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
          }
        ]
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    console.log('Notification settings updated:', this.settings);
  }

  // Chore-specific notification methods
  async notifyChoreCompleted(childName, choreName) {
    if (!this.settings.choresPendingReview) return;
    
    await this.sendLocalNotification(
      'Chore Completed! 🎉',
      `${childName} completed "${choreName}" and needs approval`,
      { type: 'chore_completed', childName, choreName }
    );
  }

  async notifyChoreAssigned(childName, choreName, createdByOtherParent = false) {
    if (createdByOtherParent && !this.settings.newChoresCreated) return;
    
    const title = createdByOtherParent ? 'New Chore Created 📝' : 'Chore Assigned 📝';
    const body = createdByOtherParent 
      ? `A new chore "${choreName}" was created for ${childName}`
      : `${childName} has a new chore: "${choreName}"`;
    
    await this.sendLocalNotification(
      title,
      body,
      { type: 'chore_assigned', childName, choreName, createdByOtherParent }
    );
  }

  async notifyGoalReached(childName, goalName, reward) {
    if (!this.settings.goalsCompleted) return;
    
    await this.sendLocalNotification(
      'Goal Achieved! 🏆',
      `${childName} reached their goal: "${goalName}" and earned ${reward}!`,
      { type: 'goal_reached', childName, goalName, reward }
    );
  }

  async notifyGoalAdded(childName, goalName, targetAmount) {
    if (!this.settings.newGoalsAdded) return;
    
    await this.sendLocalNotification(
      'New Goal Added! 🎯',
      `${childName} has a new savings goal: "${goalName}" ($${targetAmount})`,
      { type: 'goal_added', childName, goalName, targetAmount }
    );
  }

  async notifyAllowanceEarned(childName, amount) {
    await this.sendLocalNotification(
      'Allowance Earned! 💰',
      `${childName} earned $${amount} in allowance!`,
      { type: 'allowance_earned', childName, amount }
    );
  }

  async notifyChoreReminder(childName, choreName, minutesRemaining) {
    if (!this.settings.enabled) return;
    
    const title = 'Chore Due Soon! ⏰';
    const body = minutesRemaining <= 60 
      ? `${childName}, "${choreName}" is due in ${minutesRemaining} minutes!`
      : `${childName}, "${choreName}" is due in ${Math.round(minutesRemaining/60)} hours!`;
    
    await this.sendLocalNotification(
      title,
      body,
      { type: 'chore_reminder', childName, choreName, minutesRemaining }
    );
  }

  async notifyManualReminder(childName, choreName, parentName) {
    if (!this.settings.enabled) return;
    
    await this.sendLocalNotification(
      'Chore Reminder 📝',
      `${parentName} wants to remind you about: "${choreName}"`,
      { type: 'manual_reminder', childName, choreName, parentName }
    );
  }
}

export const notificationService = new NotificationService();
export default notificationService;
