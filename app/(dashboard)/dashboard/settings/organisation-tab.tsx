'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OrganisationPageClient from '../organisation/organisation-page-client';
import { Loader2 } from 'lucide-react';

export default function OrganisationTab() {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkRole() {
      try {
        const response = await fetch('/api/user-organisation-role');
        if (!response.ok) {
          router.push('/sign-in');
          return;
        }
        const data = await response.json();
        setIsOwner(data.role === 'owner');
      } catch (error) {
        console.error('Error checking role:', error);
        router.push('/sign-in');
      } finally {
        setLoading(false);
      }
    }

    checkRole();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          Only organisation owners can access organisation settings.
        </p>
      </div>
    );
  }

  return <OrganisationPageClient />;
}

