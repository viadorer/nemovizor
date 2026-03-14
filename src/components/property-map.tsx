"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { Property } from "@/lib/types";
import { formatPrice } from "@/lib/api";

// ===== Vlastní ikona markeru (pointmap.png) =====
function createMarkerIcon(_isFeatured: boolean) {
  return L.icon({
    iconUrl: "/branding/pointmap.png",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

// ===== Cenový popup =====
function createPopupContent(p: Property): string {
  const badgeColors: Record<string, string> = { sale: "#22c55e", rent: "#3b82f6", auction: "#dc2626", project: "#7c3aed", shares: "#0891b2" };
  const badgeLabels: Record<string, string> = { sale: "Prodej", rent: "Pronájem", auction: "Dražba", project: "Projekt", shares: "Podíly" };
  const bg = badgeColors[p.listingType] || "#666";
  const label = badgeLabels[p.listingType] || p.listingType;
  const badge = `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;text-transform:uppercase;">${label}</span>`;

  return `
    <div class="popup-card">
      <img src="${p.imageSrc}" alt="${p.imageAlt}" class="popup-card-img" />
      <div class="popup-card-body">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
          ${badge}
          ${p.featured ? '<span style="background:#ffb800;color:#1a1a2e;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;">Premium</span>' : ""}
        </div>
        <div style="font-weight:700;font-size:1rem;margin-bottom:4px;">${formatPrice(p.price)}</div>
        <div style="font-size:0.85rem;color:#888;margin-bottom:2px;">${p.subtype} • ${p.roomsLabel} • ${p.area} m²</div>
        <div style="font-size:0.82rem;color:#999;">${p.district}</div>
        <a href="/nemovitost/${p.slug}" style="display:block;margin-top:8px;text-align:center;padding:6px;background:#ffb800;color:#1a1a2e;border-radius:6px;font-weight:600;font-size:0.8rem;text-decoration:none;">Detail nabídky</a>
      </div>
    </div>
  `;
}

// ===== Cenový label marker (cena přímo na mapě) =====
function createPriceLabel(p: Property) {
  const shortPrice = p.price >= 1000000
    ? `${(p.price / 1000000).toFixed(1).replace(".0", "")} M`
    : p.price >= 1000
    ? `${Math.round(p.price / 1000)} tis.`
    : `${p.price}`;

  return L.divIcon({
    html: `<div class="map-price-label ${p.featured ? "map-price-label--featured" : ""}">${shortPrice}</div>`,
    className: "map-price-wrapper",
    iconSize: [80, 28],
    iconAnchor: [40, 28],
    popupAnchor: [0, -28],
  });
}

// ===== Tile layers =====
type MapStyle = "dark" | "standard" | "satellite";

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string; label: string }> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    label: "Tmavá",
  },
  standard: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    label: "Klasická",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    label: "Letecká",
  },
};

function MapStyleIcon({ style }: { style: MapStyle }) {
  const svgProps = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };
  if (style === "dark") return <svg {...svgProps}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
  if (style === "standard") return <svg {...svgProps}><path d="M1 6l7-3 8 3 7-3v15l-7 3-8-3-7 3V6z" /><path d="M8 3v15" /><path d="M16 6v15" /></svg>;
  return <svg {...svgProps}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
}

// ===== Bounds type =====
export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

// ===== PROPS =====
type PropertyMapProps = {
  properties: Property[];
  selectedPropertyId?: string | null;
  onPropertySelect?: (id: string) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  mode?: "markers" | "prices"; // markers = pin ikony, prices = cenové štítky
  singleProperty?: boolean; // pro detail stránku (1 marker, fixní zoom)
  height?: string;
  flyTo?: { lat: number; lon: number; bbox?: [number, number, number, number] } | null;
  onFlyToDone?: () => void;
};

export default function PropertyMap({
  properties: props,
  selectedPropertyId,
  onPropertySelect,
  onBoundsChange,
  mode = "prices",
  singleProperty = false,
  height = "100%",
  flyTo,
  onFlyToDone,
}: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const initialFitDoneRef = useRef(false);
  const restoredFromSessionRef = useRef(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const onFlyToDoneRef = useRef(onFlyToDone);
  onFlyToDoneRef.current = onFlyToDone;
  const flyToActiveRef = useRef(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => {
    if (typeof window === "undefined") return "dark";
    try {
      return (sessionStorage.getItem("nemovizor-map-style") as MapStyle) || "dark";
    } catch { return "dark"; }
  });

  // ===== SessionStorage klíč pro uložení stavu mapy =====
  const STORAGE_KEY = "nemovizor-map-state";

  // Filter only properties with valid coordinates
  const validProperties = useMemo(
    () => props.filter((p) => p.latitude && p.longitude),
    [props]
  );

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Obnovit uloženou pozici mapy z sessionStorage
    let initCenter: [number, number] = [49.8, 15.5];
    let initZoom = 7;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved && !singleProperty) {
        const parsed = JSON.parse(saved);
        if (parsed.lat && parsed.lng && parsed.zoom) {
          initCenter = [parsed.lat, parsed.lng];
          initZoom = parsed.zoom;
          restoredFromSessionRef.current = true;
        }
      }
    } catch { /* ignorovat */ }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    }).setView(initCenter, initZoom);

    // Initial tile layer based on saved style
    const initStyle = TILE_LAYERS[mapStyle] || TILE_LAYERS.dark;
    tileLayerRef.current = L.tileLayer(initStyle.url, {
      attribution: initStyle.attribution,
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    // @ts-ignore markerClusterGroup is added by leaflet.markercluster plugin
    markersRef.current = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: { getChildCount: () => number }) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="map-cluster-icon">${count}</div>`,
          className: "map-cluster-wrapper",
          iconSize: [40, 40],
        });
      },
    }).addTo(map);

    // Uložit stav mapy při každém pohybu/zoomu + emitovat bounds
    const saveMapState = () => {
      try {
        const center = map.getCenter();
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          lat: center.lat,
          lng: center.lng,
          zoom: map.getZoom(),
        }));
      } catch { /* ignorovat */ }
    };
    const emitBounds = () => {
      if (!mapInstanceRef.current) return;
      try {
        const b = map.getBounds();
        onBoundsChange?.({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      } catch { /* map not ready */ }
    };
    const onMapMove = () => { saveMapState(); emitBounds(); };
    map.on("moveend", onMapMove);
    map.on("zoomend", onMapMove);
    // Emit initial bounds after first render
    setTimeout(emitBounds, 200);

    // Listen for resize events (e.g. from drag-resize handle)
    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);

    return () => {
      map.off("moveend", onMapMove);
      map.off("zoomend", onMapMove);
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Update markers when properties change (NOT when selectedPropertyId changes)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    markerMapRef.current.clear();
    initialFitDoneRef.current = false;

    if (validProperties.length === 0) return;

    validProperties.forEach((p) => {
      const icon = mode === "prices"
        ? createPriceLabel(p)
        : createMarkerIcon(p.featured);

      const marker = L.marker([p.latitude, p.longitude], { icon })
        .bindPopup(createPopupContent(p), {
          maxWidth: 260,
          className: "nemovizor-popup",
        });

      marker.on("click", () => {
        onPropertySelect?.(p.id);
        // Otevřít popup okamžitě při prvním kliknutí
        setTimeout(() => marker.openPopup(), 10);
      });

      markerMapRef.current.set(p.id, marker);
      markersGroup.addLayer(marker);
    });

    // Auto-zoom to fit all markers — skip if session restored or flyTo is active
    if (restoredFromSessionRef.current) {
      restoredFromSessionRef.current = false;
    } else if (flyToActiveRef.current) {
      // flyTo is in progress — don't override with fitBounds
    } else if (validProperties.length === 1 || singleProperty) {
      const p = validProperties[0];
      map.setView([p.latitude, p.longitude], 15, { animate: true });
    } else if (!initialFitDoneRef.current) {
      // Only fitBounds on initial load, not on every data refresh
      const bounds = L.latLngBounds(
        validProperties.map((p) => [p.latitude, p.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true });
    }
    initialFitDoneRef.current = true;

    // Emit bounds after markers settle
    setTimeout(() => {
      if (!mapInstanceRef.current) return;
      try {
        const b = map.getBounds();
        onBoundsChange?.({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      } catch { /* map not ready */ }
    }, 500);
  }, [validProperties, mode, singleProperty, onPropertySelect]);

  // Open popup when selectedPropertyId changes (without resetting zoom)
  useEffect(() => {
    if (!selectedPropertyId) return;
    const marker = markerMapRef.current.get(selectedPropertyId);
    if (marker) {
      setTimeout(() => marker.openPopup(), 100);
    }
  }, [selectedPropertyId]);

  // Switch tile layer when mapStyle changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const style = TILE_LAYERS[mapStyle];
    if (!style) return;

    // Remove old tile layer
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = L.tileLayer(style.url, {
      attribution: style.attribution,
      maxZoom: 19,
    }).addTo(map);

    // Persist choice
    try { sessionStorage.setItem("nemovizor-map-style", mapStyle); } catch {}
  }, [mapStyle]);

  // FlyTo from location search — only depend on flyTo, use ref for callback
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !flyTo) return;
    flyToActiveRef.current = true;

    if (flyTo.bbox) {
      // bbox = [minLon, minLat, maxLon, maxLat]
      const bounds = L.latLngBounds(
        [flyTo.bbox[1], flyTo.bbox[0]],
        [flyTo.bbox[3], flyTo.bbox[2]]
      );
      map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 15, duration: 1.2 });
    } else {
      map.flyTo([flyTo.lat, flyTo.lon], 13, { duration: 1.2 });
    }

    // Clear flyTo flag after animation completes, then notify parent
    setTimeout(() => {
      flyToActiveRef.current = false;
      onFlyToDoneRef.current?.();
    }, 2000);
  }, [flyTo]);

  return (
    <div style={{ position: "relative", width: "100%", height, minHeight: singleProperty ? "250px" : "400px" }}>
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: singleProperty ? "12px" : "0",
          overflow: "hidden",
        }}
      />
      {!singleProperty && (
        <div className="map-style-switcher">
          {(Object.keys(TILE_LAYERS) as MapStyle[]).map((key) => (
            <button
              key={key}
              className={`map-style-btn ${mapStyle === key ? "map-style-btn--active" : ""}`}
              onClick={() => setMapStyle(key)}
              title={TILE_LAYERS[key].label}
            >
              <span className="map-style-btn-icon"><MapStyleIcon style={key} /></span>
              <span className="map-style-btn-label">{TILE_LAYERS[key].label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
