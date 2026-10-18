import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/obiekty")({
  head: () => ({
    meta: [
      { title: "Obiekty do wynajęcia" },
      { name: "description", content: "Lista sal i obiektów wraz z liczbą miejsc." },
      { property: "og:title", content: "Obiekty do wynajęcia" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Lista sal i obiektów wraz z liczbą miejsc." },
    ],
  }),
  component: VenuesPage,
});

function VenueImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("venue-images")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) return <div className="h-40 w-full animate-pulse rounded-md bg-secondary" />;
  return <img src={url} alt={alt} className="h-40 w-full rounded-md object-cover" />;
}

function VenuesPage() {
  const { user } = useSession();
  const isAdmin = useIsAdmin(user?.id);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["venues-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("venues").select("*").order("capacity");
      if (error) throw error;
      return data;
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [equipment, setEquipment] = useState("");
  const [rules, setRules] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setExistingImage(null);
    setName("");
    setCapacity("");
    setDescription("");
    setEquipment("");
    setRules("");
    setPhoto(null);
  }

  function startEdit(v: NonNullable<typeof data>[number]) {
    setEditingId(v.id);
    setExistingImage(v.image_url);
    setName(v.name);
    setCapacity(String(v.capacity));
    setDescription(v.description ?? "");
    setEquipment((v.equipment ?? []).join(", "));
    setRules(v.rules ?? "");
    setPhoto(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveVenue(e: React.FormEvent) {
    e.preventDefault();
    const cap = parseInt(capacity, 10);
    if (!name.trim() || !cap || cap < 1) {
      toast.error("Podaj nazwę i poprawną pojemność.");
      return;
    }
    setSaving(true);
    try {
      let imagePath: string | null = existingImage;
      if (photo) {
        imagePath = `${crypto.randomUUID()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("venue-images").upload(imagePath, photo);
        if (upErr) throw upErr;
      }
      const payload = {
        name: name.trim(),
        capacity: cap,
        description: description.trim() || null,
        equipment: equipment
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        rules: rules.trim() || null,
        image_url: imagePath,
      };
      const { error } = editingId
        ? await supabase.from("venues").update(payload).eq("id", editingId)
        : await supabase.from("venues").insert(payload);
      if (error) throw error;
      toast.success(editingId ? "Zmiany zapisane." : "Obiekt dodany.");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["venues-full"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się zapisać obiektu.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVenue(id: string, venueName: string) {
    if (!window.confirm(`Usunąć obiekt „${venueName}"? Powiązane rezerwacje mogą uniemożliwić usunięcie.`)) return;
    const { error } = await supabase.from("venues").delete().eq("id", id);
    if (error) {
      toast.error("Nie można usunąć obiektu — prawdopodobnie ma powiązane rezerwacje.");
      return;
    }
    toast.success("Obiekt usunięty.");
    queryClient.invalidateQueries({ queryKey: ["venues-full"] });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm uppercase tracking-widest text-accent">Nasze przestrzenie</p>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-semibold">Obiekty</h1>
        {isAdmin && (
          <Button variant={showForm ? "outline" : "default"} onClick={() => (showForm ? resetForm() : setShowForm(true))}>
            <Plus className="size-4" /> {showForm ? "Anuluj" : "Dodaj obiekt"}
          </Button>
        )}
      </div>

      {isAdmin && showForm && (
        <form onSubmit={saveVenue} className="mb-8 space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">{editingId ? `Edycja: ${name}` : "Nowy obiekt"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="v-name">Nazwa</Label>
              <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-cap">Pojemność (osób)</Label>
              <Input id="v-cap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-desc">Opis</Label>
            <Textarea id="v-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-equip">Wyposażenie (oddzielone przecinkami)</Label>
            <Input
              id="v-equip"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="np. projektor, nagłośnienie, tablica, Wi-Fi"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-rules">Regulamin obiektu</Label>
            <Textarea
              id="v-rules"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={6}
              placeholder="Wnioskodawca będzie musiał zaakceptować regulamin przy składaniu wniosku. Pozostaw puste, jeśli obiekt nie ma regulaminu."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-photo">{editingId && existingImage ? "Zmień zdjęcie" : "Zdjęcie"}</Label>
            <Input id="v-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Zapisywanie…" : editingId ? "Zapisz zmiany" : "Zapisz obiekt"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>Anuluj</Button>
          </div>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(data ?? []).map((v) => (
          <div key={v.id} className="flex flex-col gap-3 rounded-lg border bg-card p-6">
            {v.image_url && <VenueImage path={v.image_url} alt={v.name} />}
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-2xl font-semibold">{v.name}</h2>
              {isAdmin && (
                <div className="flex">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(v)} aria-label={`Edytuj ${v.name}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteVenue(v.id, v.name)} aria-label={`Usuń ${v.name}`}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
            {v.description && <p className="text-sm text-muted-foreground">{v.description}</p>}
            <p className="flex items-center gap-2 text-sm">
              <Users className="size-4" /> do {v.capacity} osób
            </p>
            {v.equipment && v.equipment.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {v.equipment.map((item) => (
                  <li key={item} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">
                    {item}
                  </li>
                ))}
              </ul>
            )}
            <Button asChild className="mt-auto w-fit">
              <Link to="/" search={{ venue: v.id }}>
                Zobacz dostępność
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
