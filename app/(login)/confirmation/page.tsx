import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CircleIcon } from 'lucide-react';
import { isEmailEnabled } from '@/lib/email/resend';

export default async function ConfirmationPage() {
  const emailEnabled = await isEmailEnabled();

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <CircleIcon className="h-12 w-12 text-orange-500" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Account Pending Confirmation
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {emailEnabled
            ? 'Please check your email to activate your account'
            : 'Your account is awaiting admin approval'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Thank you for signing up! Your account has been created successfully.
            </p>
            <p className="text-sm text-gray-700">
              {emailEnabled ? (
                <>
                  Please check your email and click the activation link to confirm your account.
                  Once activated, you'll be able to access all features of the platform.
                </>
              ) : (
                <>
                  Your account requires admin confirmation before you can access the portal.
                  An administrator will review your account and confirm it shortly. Once
                  confirmed, you'll be able to access all features of the platform.
                </>
              )}
            </p>
            <p className="text-sm text-gray-700">
              If you have any questions or need assistance, please contact support.
            </p>
          </div>

          <div className="mt-6">
            <Button asChild className="w-full rounded-full">
              <Link href="/sign-in">Back to Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

