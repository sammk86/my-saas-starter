'use client';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { customerPortalAction } from '@/lib/payments/actions';
import { useActionState } from 'react';
import { OrganisationDataWithMembers, User } from '@/lib/db/schema';
import { removeOrganisationMember, inviteOrganisationMember, cancelInvitation, updateOrganisationName } from '@/app/(login)/actions';
import useSWR from 'swr';
import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, PlusCircle, Edit2, Check, X } from 'lucide-react';

type ActionState = {
  error?: string;
  success?: string;
  name?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function OrganisationNameEditor() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: organisationData, mutate: mutateOrganisation } = useSWR<OrganisationDataWithMembers>('/api/organisation', fetcher);
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [updateState, updateAction, isUpdatePending] = useActionState<
    ActionState,
    FormData
  >(updateOrganisationName, {});

  const isOwner = user?.role === 'owner';

  // Get default name based on owner
  const defaultName = useMemo(() => {
    if (!organisationData) return '';
    
    // If organisation already has a name, use it
    if (organisationData.name && organisationData.name.trim()) {
      return organisationData.name;
    }

    // Otherwise, find the owner and use their name
    const owner = organisationData.organisationMembers?.find(m => m.role === 'owner');
    if (owner?.user) {
      const ownerName = owner.user.name || owner.user.email?.split('@')[0] || 'Organisation';
      return `${ownerName}'s Organisation`;
    }

    return 'Organisation';
  }, [organisationData]);

  // Initialize name value when data loads
  useEffect(() => {
    if (organisationData && !isEditing) {
      setNameValue(defaultName);
    }
  }, [organisationData, defaultName, isEditing]);

  // Handle successful update
  useEffect(() => {
    if (updateState?.success && !isUpdatePending) {
      setIsEditing(false);
      mutateOrganisation();
    }
  }, [updateState?.success, isUpdatePending, mutateOrganisation]);

  const handleEdit = () => {
    if (!isOwner) return;
    setNameValue(defaultName);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setNameValue(defaultName);
    setIsEditing(false);
  };

  const handleSubmit = (formData: FormData) => {
    formData.append('name', nameValue);
    updateAction(formData);
  };

  const displayName = organisationData?.name && organisationData.name.trim() 
    ? organisationData.name 
    : defaultName;

  if (!isOwner) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Organisation Name</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium">{displayName}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Only organisation owners can edit the name.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Organisation Name</CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form action={handleSubmit} className="space-y-4">
            <div>
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                placeholder="Enter organisation name"
                maxLength={100}
                disabled={isUpdatePending}
                className="text-lg font-medium"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={isUpdatePending || !nameValue.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isUpdatePending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isUpdatePending}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
            {updateState?.error && (
              <p className="text-red-500 text-sm">{updateState.error}</p>
            )}
            {updateState?.success && (
              <p className="text-green-500 text-sm">{updateState.success}</p>
            )}
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-lg font-medium">{displayName}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="text-orange-500 hover:text-orange-600"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionSkeleton() {
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>Organisation Subscription</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ManageSubscription() {
  const { data: organisationData } = useSWR<OrganisationDataWithMembers>('/api/organisation', fetcher);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Organisation Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="mb-4 sm:mb-0">
              <p className="font-medium">
                Current Plan: {organisationData?.planName || 'Free'}
              </p>
              <p className="text-sm text-muted-foreground">
                {organisationData?.subscriptionStatus === 'active'
                  ? 'Billed monthly'
                  : organisationData?.subscriptionStatus === 'trialing'
                  ? 'Trial period'
                  : 'No active subscription'}
              </p>
            </div>
            <form action={customerPortalAction}>
              <Button type="submit" variant="outline">
                Manage Subscription
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrganisationMembersSkeleton() {
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>Organisation Members</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse space-y-4 mt-1">
          <div className="flex items-center space-x-4">
            <div className="size-8 rounded-full bg-gray-200"></div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
              <div className="h-3 w-14 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrganisationMembers() {
  const { data: organisationData, mutate: mutateOrganisation } = useSWR<OrganisationDataWithMembers>('/api/organisation', fetcher);
  const [removeState, removeAction, isRemovePending] = useActionState<
    ActionState,
    FormData
  >(removeOrganisationMember, {});
  const [cancelState, cancelAction, isCancelPending] = useActionState<
    ActionState,
    FormData
  >(cancelInvitation, {});

  // Refresh organisation data when member is removed or invitation is cancelled
  useEffect(() => {
    if ((removeState?.success || cancelState?.success) && !isRemovePending && !isCancelPending) {
      mutateOrganisation();
    }
  }, [removeState?.success, cancelState?.success, isRemovePending, isCancelPending, mutateOrganisation]);

  const getUserDisplayName = (user: Pick<User, 'id' | 'name' | 'email'>) => {
    return user.name || user.email || 'Unknown User';
  };

  const activeMembers = organisationData?.organisationMembers || [];
  const pendingInvitations = organisationData?.invitations || [];
  const hasAnyMembers = activeMembers.length > 0 || pendingInvitations.length > 0;

  if (!hasAnyMembers) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Organisation Members</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No organisation members yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Organisation Members</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {activeMembers.map((member, index) => (
            <li key={member.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarFallback>
                    {getUserDisplayName(member.user)
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {getUserDisplayName(member.user)}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {member.role} • Active
                  </p>
                </div>
              </div>
              {index > 1 ? (
                <form action={removeAction}>
                  <input type="hidden" name="memberId" value={member.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={isRemovePending}
                  >
                    {isRemovePending ? 'Removing...' : 'Remove'}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
          {pendingInvitations.map((invitation) => (
            <li key={`invitation-${invitation.id}`} className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarFallback>
                    {invitation.email
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {invitation.email}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {invitation.role} • <span className="text-yellow-600">Pending</span>
                  </p>
                </div>
              </div>
              <form action={cancelAction}>
                <input type="hidden" name="invitationId" value={invitation.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={isCancelPending}
                >
                  {isCancelPending ? 'Cancelling...' : 'Cancel'}
                </Button>
              </form>
            </li>
          ))}
        </ul>
        {removeState?.error && (
          <p className="text-red-500 mt-4">{removeState.error}</p>
        )}
        {cancelState?.error && (
          <p className="text-red-500 mt-4">{cancelState.error}</p>
        )}
        {cancelState?.success && (
          <p className="text-green-500 mt-4">{cancelState.success}</p>
        )}
      </CardContent>
    </Card>
  );
}

function InviteOrganisationMemberSkeleton() {
  return (
    <Card className="h-[260px]">
      <CardHeader>
        <CardTitle>Invite Organisation Member</CardTitle>
      </CardHeader>
    </Card>
  );
}

function InviteOrganisationMember() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { mutate: mutateOrganisation } = useSWR<OrganisationDataWithMembers>('/api/organisation', fetcher);
  const isOwner = user?.role === 'owner';
  const [inviteState, inviteAction, isInvitePending] = useActionState<
    ActionState,
    FormData
  >(inviteOrganisationMember, {});
  const hasRefreshed = useRef(false);

  // Refresh organisation data when invitation is successful
  useEffect(() => {
    if (inviteState?.success && !isInvitePending && !hasRefreshed.current) {
      hasRefreshed.current = true;
      mutateOrganisation();
      // Reset after a delay to allow future refreshes
      setTimeout(() => {
        hasRefreshed.current = false;
      }, 1000);
    }
  }, [inviteState?.success, isInvitePending, mutateOrganisation]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Organisation Member</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={inviteAction} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mb-2">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter email"
              required
              disabled={!isOwner}
            />
          </div>
          <div>
            <Label>Role</Label>
            <RadioGroup
              defaultValue="member"
              name="role"
              className="flex space-x-4"
              disabled={!isOwner}
            >
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="member" id="member" />
                <Label htmlFor="member">Member</Label>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="owner" id="owner" />
                <Label htmlFor="owner">Owner</Label>
              </div>
            </RadioGroup>
          </div>
          {inviteState?.error && (
            <p className="text-red-500">{inviteState.error}</p>
          )}
          {inviteState?.success && (
            <p className="text-green-500">{inviteState.success}</p>
          )}
          <Button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={isInvitePending || !isOwner}
          >
            {isInvitePending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                Invite Member
              </>
            )}
          </Button>
        </form>
      </CardContent>
      {!isOwner && (
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            You must be an organisation owner to invite new members.
          </p>
        </CardFooter>
      )}
    </Card>
  );
}

export default function OrganisationPageClient() {
  return (
    <div>
      <Suspense fallback={<div className="mb-8 h-[140px] bg-gray-100 rounded animate-pulse" />}>
        <OrganisationNameEditor />
      </Suspense>
      <Suspense fallback={<SubscriptionSkeleton />}>
        <ManageSubscription />
      </Suspense>
      <Suspense fallback={<OrganisationMembersSkeleton />}>
        <OrganisationMembers />
      </Suspense>
      <Suspense fallback={<InviteOrganisationMemberSkeleton />}>
        <InviteOrganisationMember />
      </Suspense>
    </div>
  );
}

