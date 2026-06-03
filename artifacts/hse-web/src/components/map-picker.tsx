import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface Marker {
  id: string;
  x: number;
  y: number;
  color: "red" | "yellow" | "green";
}

export interface MapSelection {
  mapId: number | null;
  markers: Marker[];
}

interface MapRecord {
  id: number;
  name: string;
  fileType: string;
  driveFileId?: string | null;
  viewUrl?: string | null;
}

const COLOR_OPTIONS: { value: Marker["color"]; label: string; bg: string; border: string }[] = [
  { value: "red",    label: "Merah",  bg: "#ef4444", border: "#b91c1c" },
  { value: "yellow", label: "Kuning", bg: "#eab308", border: "#854d0e" },
  { value: "green",  label: "Hijau",  bg: "#22c55e", border: "#166534" },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function MapCanvas({
  mapId,
  driveFileId,
  fileType,
  markers,
  onMarkersChange,
}: {
  mapId: number;
  driveFileId: string;
  fileType: string;
  markers: Marker[];
  onMarkersChange: (m: Marker[]) => void;
}) {
  const [selectedColor, setSelectedColor] = useState<Marker["color"]>("red");
  const overlayRef = useRef<HTMLDivElement>(null);

  // For images: use server-side proxy to avoid Google Drive CORS/redirect issues
  // For PDFs: use Google Drive's embeddable preview iframe (works natively)
  const displayUrl = fileType === "pdf"
    ? `https://drive.google.com/file/d/${driveFileId}/preview`
    : `${BASE}/api/maps/${mapId}/image`;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onMarkersChange([...markers, { id: generateId(), x, y, color: selectedColor }]);
  };

  const removeMarker = (id: string) => {
    onMarkersChange(markers.filter(m => m.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Warna marker:</span>
        {COLOR_OPTIONS.map(c => (
          <button
            key={c.value}
            type="button"
            onClick={() => setSelectedColor(c.value)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white transition-all"
            style={{
              backgroundColor: c.bg,
              outline: selectedColor === c.value ? `3px solid ${c.border}` : "3px solid transparent",
              outlineOffset: "1px",
              transform: selectedColor === c.value ? "scale(1.08)" : "scale(1)",
            }}
          >
            {c.label}
          </button>
        ))}
        {markers.length > 0 && (
          <button
            type="button"
            onClick={() => onMarkersChange([])}
            className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1 border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Hapus semua
          </button>
        )}
      </div>

      <div className="relative bg-gray-100 rounded-lg overflow-hidden border border-gray-300" style={{ height: 460 }}>
        {fileType === "pdf" ? (
          <iframe
            src={displayUrl}
            title="Map"
            style={{ width: "100%", height: "100%", border: "none", pointerEvents: "none" }}
          />
        ) : (
          <img
            src={displayUrl}
            alt="Map"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              userSelect: "none",
              display: "block",
            }}
            draggable={false}
          />
        )}

        <div
          ref={overlayRef}
          style={{ position: "absolute", inset: 0, zIndex: 10, cursor: "crosshair" }}
          onClick={handleOverlayClick}
        >
          {markers.map(m => {
            const col = COLOR_OPTIONS.find(c => c.value === m.color);
            return (
              <div
                key={m.id}
                style={{
                  position: "absolute",
                  left: `${m.x}%`,
                  top: `${m.y}%`,
                  transform: "translate(-50%, -50%)",
                  width: 22,
                  height: 22,
                  backgroundColor: col?.bg ?? "#ef4444",
                  border: "2.5px solid white",
                  boxShadow: "0 0 0 1.5px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.4)",
                  borderRadius: 4,
                  zIndex: 20,
                  cursor: "pointer",
                  transition: "transform 0.1s",
                }}
                onClick={e => { e.stopPropagation(); removeMarker(m.id); }}
                title="Klik untuk hapus"
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Klik pada map untuk menambah marker · Klik marker untuk menghapus</span>
        <span>{markers.length} marker ditempatkan</span>
      </div>
    </div>
  );
}

export function MapPicker({
  value,
  onChange,
}: {
  value: MapSelection;
  onChange: (v: MapSelection) => void;
}) {
  const [enabled, setEnabled] = useState(!!value.mapId);
  const [open, setOpen] = useState(false);
  const [draftMapId, setDraftMapId] = useState<number | null>(value.mapId);
  const [draftMarkers, setDraftMarkers] = useState<Marker[]>(value.markers);

  const { data: maps = [] } = useQuery<MapRecord[]>({
    queryKey: ["maps"],
    queryFn: () => api.get("/maps"),
    enabled: open || enabled,
    staleTime: 30000,
  });

  const selectedMap = maps.find(m => m.id === value.mapId);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      onChange({ mapId: null, markers: [] });
      setDraftMapId(null);
      setDraftMarkers([]);
    }
  };

  const handleOpen = () => {
    setDraftMapId(value.mapId);
    setDraftMarkers([...value.markers]);
    setOpen(true);
  };

  const handleConfirm = () => {
    onChange({ mapId: draftMapId, markers: draftMapId ? draftMarkers : [] });
    setOpen(false);
  };

  const handleMapChange = (idStr: string) => {
    setDraftMapId(parseInt(idStr));
    setDraftMarkers([]);
  };

  const markerCounts = value.markers.reduce((acc, m) => {
    acc[m.color] = (acc[m.color] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id="use-map"
          checked={enabled}
          onCheckedChange={v => handleToggle(v === true)}
        />
        <Label htmlFor="use-map" className="cursor-pointer flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          Tandai Lokasi di Map
          <span className="text-xs text-gray-400 font-normal">(opsional)</span>
        </Label>
      </div>

      {enabled && (
        <div className="ml-6 space-y-2">
          <Button type="button" variant="outline" size="sm" onClick={handleOpen} className="gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {value.mapId ? "Edit Lokasi di Map" : "Pilih & Tandai Map"}
          </Button>

          {value.mapId && selectedMap && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {selectedMap.name}
              </span>
              {(markerCounts.red ?? 0) > 0 && (
                <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                  {markerCounts.red} merah
                </span>
              )}
              {(markerCounts.yellow ?? 0) > 0 && (
                <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "#fef9c3", color: "#854d0e" }}>
                  {markerCounts.yellow} kuning
                </span>
              )}
              {(markerCounts.green ?? 0) > 0 && (
                <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "#dcfce7", color: "#166534" }}>
                  {markerCounts.green} hijau
                </span>
              )}
              {value.markers.length === 0 && (
                <span className="text-xs text-gray-400">Belum ada marker ditandai</span>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Pilih & Tandai Lokasi di Map
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Pilih Map</Label>
              {maps.length === 0 ? (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Belum ada map tersedia. Tambahkan di Master Data → Map Lokasi.
                </p>
              ) : (
                <Select value={draftMapId ? String(draftMapId) : ""} onValueChange={handleMapChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih map lokasi..." />
                  </SelectTrigger>
                  <SelectContent>
                    {maps.map(m => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                        <span className="text-xs text-gray-400 ml-2">({m.fileType.toUpperCase()})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {draftMapId && (() => {
              const m = maps.find(x => x.id === draftMapId);
              return m?.driveFileId ? (
                <MapCanvas
                  mapId={m.id}
                  driveFileId={m.driveFileId}
                  fileType={m.fileType}
                  markers={draftMarkers}
                  onMarkersChange={setDraftMarkers}
                />
              ) : m ? (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  File map belum tersedia di Google Drive.
                </p>
              ) : null;
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleConfirm} disabled={!draftMapId}>
              Konfirmasi ({draftMarkers.length} marker)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
