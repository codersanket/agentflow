"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsGeneralPage() {
  const user = useAuthStore((s) => s.user);

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadOrg() {
      try {
        const org = await api.org.get();
        setOrgName(org.name);
        setOrgSlug(org.slug);
      } catch {
        toast.error("Failed to load organization details");
      } finally {
        setIsLoadingOrg(false);
      }
    }
    loadOrg();
  }, []);

  const handleSaveOrg = async () => {
    if (!orgName.trim()) {
      toast.error("Organization name cannot be empty");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await api.org.update({ name: orgName.trim() });
      setOrgName(updated.name);
      setOrgSlug(updated.slug);
      toast.success("Organization updated successfully");
    } catch {
      toast.error("Failed to update organization");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            Manage your organization details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingOrg ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  placeholder="Acme Inc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">Organization slug</Label>
                <Input
                  id="org-slug"
                  placeholder="acme-inc"
                  value={orgSlug}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  The slug is auto-generated and cannot be changed.
                </p>
              </div>
              <Button onClick={handleSaveOrg} disabled={isSaving}>
                {isSaving && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Save changes
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              defaultValue={user?.name || ""}
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              defaultValue={user?.email || ""}
              disabled
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Profile editing is not yet available.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
