import React, { useState, useEffect } from 'react';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  CheckCheck,
  Sparkles,
} from 'lucide-react';
import { NotificationItem } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  subscribeNotifications,
  markNotificationRead,
} from '../services/firestoreService';

interface NotificationsViewProps {
  onOpenUserProfile?: (userId: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onOpenUserProfile,
}) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeNotifications(currentUser.uid, (list) => {
      setNotifications(list);
    });
    return () => unsub();
  }, [currentUser]);

  const handleMarkRead = (notifId: string) => {
    if (!currentUser) return;
    markNotificationRead(currentUser.uid, notifId);
  };

  const handleMarkAllRead = () => {
    if (!currentUser) return;
    notifications.forEach((n) => {
      if (!n.read) {
        markNotificationRead(currentUser.uid, n.id);
      }
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-[#00C853] fill-[#00C853]" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-teal-500" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-[#00C853]" />;
      default:
        return <Sparkles className="w-4 h-4 text-[#00C853]" />;
    }
  };

  const getText = (n: NotificationItem) => {
    switch (n.type) {
      case 'like':
        return 'watered your sprout with a like 🌿';
      case 'comment':
        return 'commented on your sprout 🌱';
      case 'follow':
        return 'started following your garden 🍃';
      default:
        return 'interacted with your content ✨';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-2">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#00C853]/20 dark:border-emerald-800/40">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#00C853]" />
          <h2 className="text-lg font-bold text-[#12372A] dark:text-white">
            Garden Notifications
          </h2>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-bold text-[#00C853] hover:underline cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {notifications.length > 0 ? (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleMarkRead(n.id)}
              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                n.read
                  ? 'bg-white dark:bg-[#12372A]/40 border-stone-100 dark:border-emerald-800/30'
                  : 'bg-[#00C853]/10 dark:bg-emerald-900/30 border-[#00C853]/30 dark:border-emerald-700/60 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={n.senderPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt={n.senderName}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00C853]/30"
                  />
                  <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white dark:bg-[#101512] shadow-sm">
                    {getIcon(n.type)}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-stone-800 dark:text-stone-100">
                    <span
                      className="font-bold cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenUserProfile) onOpenUserProfile(n.senderId);
                      }}
                    >
                      {n.senderName}
                    </span>{' '}
                    {getText(n)}
                  </p>
                  <span className="text-[10px] text-stone-400">
                    {new Date(n.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {!n.read && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#00C853] shrink-0" />
              )}
            </div>
          ))
        ) : (
          <div className="p-12 text-center bg-white dark:bg-[#12372A]/40 rounded-3xl border border-[#00C853]/20 dark:border-emerald-800">
            <Bell className="w-10 h-10 text-[#00C853]/40 mx-auto mb-2" />
            <p className="text-xs text-stone-500">
              Your garden notifications are serene. New likes, comments, and follows will sprout here! 🌿
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
