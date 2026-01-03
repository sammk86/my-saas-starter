'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, Activity, Shield } from 'lucide-react';
import GeneralTab from './general-tab';
import OrganisationTab from './organisation-tab';
import ActivityTab from './activity-tab';
import SecurityTab from './security-tab';
import { Loader2 } from 'lucide-react';

export default function SettingsTabs() {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkRole() {
      try {
        const response = await fetch('/api/user-organisation-role');
        if (response.ok) {
          const data = await response.json();
          setIsOwner(data.role === 'owner');
        } else {
          setIsOwner(false);
        }
      } catch (error) {
        console.error('Error checking role:', error);
        setIsOwner(false);
      } finally {
        setLoading(false);
      }
    }

    checkRole();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  const gridCols = isOwner ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className={`grid w-full ${gridCols}`}>
        <TabsTrigger value="general" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          General
        </TabsTrigger>
        {isOwner && (
          <TabsTrigger value="organisation" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Organisation
          </TabsTrigger>
        )}
        <TabsTrigger value="activity" className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Activity
        </TabsTrigger>
        <TabsTrigger value="security" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Security
        </TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="mt-6">
        <GeneralTab />
      </TabsContent>
      {isOwner && (
        <TabsContent value="organisation" className="mt-6">
          <OrganisationTab />
        </TabsContent>
      )}
      <TabsContent value="activity" className="mt-6">
        <ActivityTab />
      </TabsContent>
      <TabsContent value="security" className="mt-6">
        <SecurityTab />
      </TabsContent>
    </Tabs>
  );
}

