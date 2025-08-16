import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import notificationService from '../services/notificationService';

function Settings({ user }) {
  const [settings, setSettings] = useState({
    notifications: {
      enabled: true,
      newChoresCreated: true,
      choresPendingReview: true,
      newGoalsAdded: true,
      goalsCompleted: true,
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', user.uid));
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setSettings(prev => ({
          ...prev,
          ...data
        }));
      } else {
        // Create default settings document
        await setDoc(doc(db, 'settings', user.uid), settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'settings', user.uid), newSettings);
      
      // Update notification service with new settings
      notificationService.updateSettings(newSettings.notifications);
      
      toast.success('Settings saved successfully! 💾');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = async (settingName) => {
    const newSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        [settingName]: !settings.notifications[settingName]
      }
    };
    
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleMasterNotificationToggle = async () => {
    const newEnabled = !settings.notifications.enabled;
    const newSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        enabled: newEnabled,
        // If disabling, turn off all notifications
        // If enabling, keep current sub-settings
        ...(newEnabled ? {} : {
          newChoresCreated: false,
          choresPendingReview: false,
          newGoalsAdded: false,
          goalsCompleted: false,
        })
      }
    };
    
    setSettings(newSettings);
    await saveSettings(newSettings);
    
    if (!newEnabled) {
      toast.success('All notifications disabled 🔕');
    } else {
      toast.success('Notifications enabled 🔔');
    }
  };

  const testNotification = async () => {
    try {
      await notificationService.sendLocalNotification(
        'Test Notification 🧪',
        'This is a test notification to make sure everything is working!',
        { type: 'test' }
      );
      toast.success('Test notification sent! Check your notification panel.');
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center py-8">
          <div className="text-2xl">⚙️</div>
          <p className="text-gray-600 mt-2">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="text-3xl">⚙️</div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <p className="text-gray-600">Customize your app experience</p>
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🔔</div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Notifications</h3>
              <p className="text-gray-600">Control when you receive notifications</p>
            </div>
          </div>
          <button
            onClick={testNotification}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            🧪 Test
          </button>
        </div>

        {/* Master Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="text-xl">{settings.notifications.enabled ? '🔔' : '🔕'}</div>
              <div>
                <div className="font-medium text-gray-900">Enable Notifications</div>
                <div className="text-sm text-gray-600">Turn all notifications on or off</div>
              </div>
            </div>
            <button
              onClick={handleMasterNotificationToggle}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.notifications.enabled ? 'bg-green-500' : 'bg-gray-300'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.notifications.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Individual Notification Settings */}
          {settings.notifications.enabled && (
            <div className="space-y-3 pl-4 border-l-2 border-blue-200">
              <div className="text-sm text-gray-600 mb-3 font-medium">
                Notification Types:
              </div>
              
              {[
                {
                  key: 'newChoresCreated',
                  title: 'New Chores Created',
                  description: 'When other parents create new chores',
                  icon: '🧹'
                },
                {
                  key: 'choresPendingReview',
                  title: 'Chores Pending Review',
                  description: 'When children complete chores awaiting approval',
                  icon: '⏳'
                },
                {
                  key: 'newGoalsAdded',
                  title: 'New Goals Added',
                  description: 'When new goals are created for children',
                  icon: '🎯'
                },
                {
                  key: 'goalsCompleted',
                  title: 'Goals Completed',
                  description: 'When children reach their savings goals',
                  icon: '🏆'
                }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="text-lg">{item.icon}</div>
                    <div>
                      <div className="font-medium text-gray-900">{item.title}</div>
                      <div className="text-sm text-gray-600">{item.description}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleNotificationToggle(item.key)}
                    disabled={saving}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      settings.notifications[item.key] ? 'bg-green-500' : 'bg-gray-300'
                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        settings.notifications[item.key] ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Permission Status */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-2">
            <div className="text-blue-600">ℹ️</div>
            <div className="text-sm text-blue-800">
              <strong>Note:</strong> Make sure notification permissions are enabled in your device settings for the best experience.
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Section */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="text-2xl">🚀</div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Coming Soon</h3>
            <p className="text-gray-600">More settings will be added in future updates</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: '🎨', title: 'Theme Settings', desc: 'Customize app colors and appearance' },
            { icon: '👤', title: 'Profile Settings', desc: 'Manage your family profile information' },
            { icon: '💰', title: 'Currency Settings', desc: 'Choose your preferred currency' },
            { icon: '🔒', title: 'Privacy Settings', desc: 'Control data sharing and privacy options' }
          ].map((item, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-60">
              <div className="flex items-center space-x-3">
                <div className="text-xl">{item.icon}</div>
                <div>
                  <div className="font-medium text-gray-900">{item.title}</div>
                  <div className="text-sm text-gray-600">{item.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Settings;
