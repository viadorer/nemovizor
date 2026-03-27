"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { Property } from "@/lib/types";
import { formatPrice } from "@/lib/api";
import { useT } from "@/i18n/provider";
import type { Translation } from "@/i18n/types";

// ===== Vlastní ikona markeru (pointmap.png) =====
function createMarkerIcon(_isFeatured: boolean) {
  return L.icon({
    iconUrl: "/branding/pointmap.png",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

// ===== HTML escape pro bezpečné vložení do popup =====
function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ===== Cenový popup =====
function createPopupContent(p: Property, t: Translation): string {
  const badgeColors: Record<string, string> = { sale: "#22c55e", rent: "#3b82f6", auction: "#dc2626", project: "#7c3aed", shares: "#0891b2" };
  const bg = badgeColors[p.listingType] || "#666";
  const label = t.enumLabels.listingTypes[p.listingType] || p.listingType;
  const badge = `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;text-transform:uppercase;">${esc(label)}</span>`;

  return `
    <div class="popup-card">
      <img src="${esc(p.imageSrc)}" alt="${esc(p.imageAlt)}" class="popup-card-img" />
      <div class="popup-card-body">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
          ${badge}
          ${p.featured ? `<span style="background:#ffb800;color:#1a1a2e;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;">${esc(t.badges.premium)}</span>` : ""}
        </div>
        <div style="font-weight:700;font-size:1rem;margin-bottom:4px;">${formatPrice(p.price, p.priceCurrency)}</div>
        <div style="font-size:0.85rem;color:#888;margin-bottom:2px;">${esc(p.subtype)} • ${esc(p.roomsLabel)} • ${p.area} m²</div>
        <div style="font-size:0.82rem;color:#999;">${esc(p.district)}</div>
        <a href="/nemovitost/${encodeURIComponent(p.slug)}" style="display:block;margin-top:8px;text-align:center;padding:6px;background:#ffb800;color:#1a1a2e;border-radius:6px;font-weight:600;font-size:0.8rem;text-decoration:none;">${esc(t.map.detailLink)}</a>
      </div>
    </div>
  `;
}

// ===== Cenový label marker (cena přímo na mapě) =====
function createPriceLabel(p: Property) {
  if (!p.price) {
    return L.divIcon({
      html: `<div class="map-price-label ${p.featured ? "map-price-label--featured" : ""}">N/A</div>`,
      className: "map-price-wrapper",
      iconSize: [48, 28],
      iconAnchor: [24, 28],
      popupAnchor: [0, -28],
    });
  }
  const cur = (p.priceCurrency ?? "czk").toLowerCase();
  const prefix = cur === "gbp" ? "\u00A3" : cur === "eur" ? "\u20AC" : "";
  const suffix = cur === "czk" ? " tis." : "k";
  const shortPrice = p.price >= 1000000
    ? `${prefix}${(p.price / 1000000).toFixed(1).replace(".0", "")} M`
    : p.price >= 1000
    ? `${prefix}${Math.round(p.price / 1000)}${suffix}`
    : `${prefix}${p.price}`;

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

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string }> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  standard: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
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
  zoom: number;
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
  truncated?: boolean; // true = map points were capped at limit, clusters show "+"
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
  truncated = false,
}: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const serverClusterLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const initialFitDoneRef = useRef(false);
  const truncatedRef = useRef(truncated);
  truncatedRef.current = truncated;
  const restoredFromSessionRef = useRef(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const poiLayerRef = useRef<L.LayerGroup | null>(null);
  const poiCacheRef = useRef<Map<string, L.CircleMarker[]>>(new Map());
  const onFlyToDoneRef = useRef(onFlyToDone);
  onFlyToDoneRef.current = onFlyToDone;
  const flyToActiveRef = useRef(false);
  const [poiCategories, setPoiCategories] = useState<string[]>([]);
  const [poiOpen, setPoiOpen] = useState(false);
  const poiRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => {
    if (typeof window === "undefined") return "standard";
    try {
      return (sessionStorage.getItem("nemovizor-map-style") as MapStyle) || "standard";
    } catch { return "standard"; }
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
      maxClusterRadius: (zoom: number) => {
        // Smaller radius at low zoom = cities stay separate; larger at high zoom = natural grouping
        if (zoom <= 6) return 60;
        if (zoom <= 8) return 45;
        if (zoom <= 10) return 35;
        return 25;
      },
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: { getChildCount: () => number }) => {
        const count = cluster.getChildCount();
        const plus = truncatedRef.current ? "+" : "";
        const label = count >= 1000000
          ? `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M${plus}`
          : count >= 1000
          ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k${plus}`
          : `${count}${plus}`;
        const size = count >= 100000 ? 56 : count >= 10000 ? 52 : count >= 1000 ? 44 : 36;
        return L.divIcon({
          html: `<div class="map-cluster-icon" style="width:${size}px;height:${size}px;line-height:${size}px;font-size:${size > 44 ? 13 : 12}px;">${label}</div>`,
          className: "map-cluster-wrapper",
          iconSize: [size, size],
        });
      },
    }).addTo(map);

    // Separate layer for server-side cluster markers (not inside markerClusterGroup)
    serverClusterLayerRef.current = L.layerGroup().addTo(map);

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
          zoom: map.getZoom(),
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
      serverClusterLayerRef.current = null;
    };
  }, []);

  // ── Render markers (server clusters at zoom < 13, real pins at zoom ≥ 13) ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    serverClusterLayerRef.current?.clearLayers();
    markerMapRef.current.clear();

    if (validProperties.length === 0) return;

    validProperties.forEach((p) => {
      // ── Property pin ─────────────────────────────────────────────────────
      const icon = mode === "prices"
        ? createPriceLabel(p)
        : createMarkerIcon(p.featured);

      const marker = L.marker([p.latitude, p.longitude], { icon })
        .bindPopup(createPopupContent(p, t), {
          maxWidth: 260,
          className: "nemovizor-popup",
        });

      marker.on("click", () => {
        onPropertySelect?.(p.id);
        setTimeout(() => marker.openPopup(), 10);
      });

      markerMapRef.current.set(p.id, marker);
      markersGroup.addLayer(marker);
    });

    // Auto-zoom only on first load or for single property view
    if (restoredFromSessionRef.current) {
      restoredFromSessionRef.current = false;
    } else if (singleProperty && validProperties.length >= 1) {
      const p = validProperties[0];
      map.setView([p.latitude, p.longitude], 15, { animate: true });
    } else if (!initialFitDoneRef.current && !flyToActiveRef.current) {
      // First load — show Czech Republic bounds (not all markers which may span multiple countries)
      const czBounds = L.latLngBounds([[48.55, 12.09], [51.06, 18.86]]);
      map.fitBounds(czBounds, { padding: [40, 40], maxZoom: 14, animate: true });
    }
    // After first fit, never auto-zoom again (user controls the viewport)
    initialFitDoneRef.current = true;
  }, [validProperties, mode, singleProperty, onPropertySelect]);

  // Highlight marker when selectedPropertyId changes (hover from grid)
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    // Remove highlight from previous marker
    if (prevSelectedRef.current) {
      const prevMarker = markerMapRef.current.get(prevSelectedRef.current);
      if (prevMarker) {
        const el = prevMarker.getElement();
        if (el) el.classList.remove("map-marker--highlighted");
      }
    }
    prevSelectedRef.current = selectedPropertyId || null;

    if (!selectedPropertyId) return;
    const marker = markerMapRef.current.get(selectedPropertyId);
    if (marker) {
      const el = marker.getElement();
      if (el) el.classList.add("map-marker--highlighted");
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

  // ===== POI (Points of Interest) =====
  const POI_DEFS: Record<string, { label: string; color: string; query: string }> = useMemo(() => ({
    school: { label: t.map.poi.school, color: "#f59e0b", query: 'node["amenity"~"school|kindergarten"]' },
    transport: { label: t.map.poi.transport, color: "#3b82f6", query: 'node["public_transport"="stop_position"]' },
    shop: { label: t.map.poi.shop, color: "#10b981", query: 'node["shop"~"supermarket|convenience|mall"]' },
    restaurant: { label: t.map.poi.restaurant, color: "#ef4444", query: 'node["amenity"~"restaurant|cafe|fast_food"]' },
    health: { label: t.map.poi.health, color: "#ec4899", query: 'node["amenity"~"hospital|clinic|pharmacy|doctors"]' },
    sport: { label: t.map.poi.sport, color: "#8b5cf6", query: 'node["leisure"~"fitness_centre|sports_centre|swimming_pool|pitch"]' },
    park: { label: t.map.poi.park, color: "#22c55e", query: 'node["leisure"~"park|garden|playground"]' },
  }), [t]);

  useEffect(() => {
    if (poiRef.current) {
      const handler = (e: MouseEvent) => {
        if (poiRef.current && !poiRef.current.contains(e.target as Node)) setPoiOpen(false);
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [poiOpen]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!poiLayerRef.current) {
      poiLayerRef.current = L.layerGroup().addTo(map);
    }
    const layer = poiLayerRef.current;
    layer.clearLayers();

    if (poiCategories.length === 0) return;

    const bounds = map.getBounds();
    const south = bounds.getSouth(), west = bounds.getWest(), north = bounds.getNorth(), east = bounds.getEast();
    const zoom = map.getZoom();
    if (zoom < 12) return; // Don't fetch POI at low zoom

    const queries = poiCategories.map((cat) => {
      const def = POI_DEFS[cat];
      if (!def) return "";
      return `${def.query}(${south},${west},${north},${east});`;
    }).join("");

    const overpassQuery = `[out:json][timeout:10];(${queries});out center 500;`;
    const cacheKey = `${poiCategories.sort().join(",")}-${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;

    if (poiCacheRef.current.has(cacheKey)) {
      poiCacheRef.current.get(cacheKey)!.forEach((m) => layer.addLayer(m));
      return;
    }

    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`)
      .then((r) => r.json())
      .then((data) => {
        const markers: L.CircleMarker[] = [];
        for (const el of data.elements || []) {
          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          if (!lat || !lon) continue;

          // Determine category
          let color = "#888";
          let tooltip = el.tags?.name || "";
          for (const cat of poiCategories) {
            const def = POI_DEFS[cat];
            if (!def) continue;
            // Simple match
            const tags = el.tags || {};
            if (cat === "school" && (tags.amenity === "school" || tags.amenity === "kindergarten")) { color = def.color; tooltip = tooltip || tags.amenity; break; }
            if (cat === "transport" && tags.public_transport) { color = def.color; tooltip = tooltip || t.map.poi.transportStop; break; }
            if (cat === "shop" && tags.shop) { color = def.color; tooltip = tooltip || tags.shop; break; }
            if (cat === "restaurant" && (tags.amenity === "restaurant" || tags.amenity === "cafe" || tags.amenity === "fast_food")) { color = def.color; tooltip = tooltip || tags.amenity; break; }
            if (cat === "health" && (tags.amenity === "hospital" || tags.amenity === "clinic" || tags.amenity === "pharmacy" || tags.amenity === "doctors")) { color = def.color; tooltip = tooltip || tags.amenity; break; }
            if (cat === "sport" && tags.leisure) { color = def.color; tooltip = tooltip || tags.leisure; break; }
            if (cat === "park" && tags.leisure) { color = def.color; tooltip = tooltip || tags.leisure; break; }
          }

          const marker = L.circleMarker([lat, lon], {
            radius: 4, fillColor: color, color: "#fff", weight: 1, fillOpacity: 0.85,
          });
          if (tooltip) marker.bindTooltip(tooltip, { direction: "top", offset: [0, -6] });
          markers.push(marker);
          layer.addLayer(marker);
        }
        poiCacheRef.current.set(cacheKey, markers);
      })
      .catch(() => {});

    // Re-fetch on move
    const onMoveEnd = () => {
      if (poiCategories.length === 0) return;
      const b = map.getBounds();
      const z = map.getZoom();
      if (z < 12) { layer.clearLayers(); return; }
      const s = b.getSouth(), w = b.getWest(), n = b.getNorth(), e = b.getEast();
      const qs = poiCategories.map((cat) => {
        const def = POI_DEFS[cat];
        return def ? `${def.query}(${s},${w},${n},${e});` : "";
      }).join("");
      const q = `[out:json][timeout:10];(${qs});out center 500;`;
      const ck = `${poiCategories.sort().join(",")}-${s.toFixed(3)},${w.toFixed(3)},${n.toFixed(3)},${e.toFixed(3)}`;
      if (poiCacheRef.current.has(ck)) {
        layer.clearLayers();
        poiCacheRef.current.get(ck)!.forEach((m) => layer.addLayer(m));
        return;
      }
      fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          layer.clearLayers();
          const ms: L.CircleMarker[] = [];
          for (const el of data.elements || []) {
            const lat2 = el.lat ?? el.center?.lat;
            const lon2 = el.lon ?? el.center?.lon;
            if (!lat2 || !lon2) continue;
            let col = "#888", tt = el.tags?.name || "";
            for (const cat of poiCategories) {
              const def = POI_DEFS[cat];
              if (!def) continue;
              const t = el.tags || {};
              if ((cat === "school" && (t.amenity === "school" || t.amenity === "kindergarten")) ||
                  (cat === "transport" && t.public_transport) ||
                  (cat === "shop" && t.shop) ||
                  (cat === "restaurant" && (t.amenity === "restaurant" || t.amenity === "cafe" || t.amenity === "fast_food")) ||
                  (cat === "health" && (t.amenity === "hospital" || t.amenity === "clinic" || t.amenity === "pharmacy" || t.amenity === "doctors")) ||
                  (cat === "sport" && t.leisure) ||
                  (cat === "park" && t.leisure)) {
                col = def.color; tt = tt || t.amenity || t.leisure || t.shop || def.label;
                break;
              }
            }
            const m = L.circleMarker([lat2, lon2], { radius: 4, fillColor: col, color: "#fff", weight: 1, fillOpacity: 0.85 });
            if (tt) m.bindTooltip(tt, { direction: "top", offset: [0, -6] });
            ms.push(m);
            layer.addLayer(m);
          }
          poiCacheRef.current.set(ck, ms);
        })
        .catch(() => {});
    };
    map.on("moveend", onMoveEnd);
    return () => { map.off("moveend", onMoveEnd); };
  }, [poiCategories]);

  // FlyTo from location search — only depend on flyTo, use ref for callback
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !flyTo) return;
    flyToActiveRef.current = true;

    try {
      // Check map container has dimensions (hidden on mobile list view)
      const container = map.getContainer();
      if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
        // Map is hidden — store flyTo and apply when map becomes visible
        flyToActiveRef.current = false;
        onFlyToDoneRef.current?.();
        return;
      }

      if (
        flyTo.bbox &&
        Array.isArray(flyTo.bbox) &&
        flyTo.bbox.length >= 4 &&
        flyTo.bbox.every((v) => typeof v === "number" && !isNaN(v))
      ) {
        // bbox = [minLon, minLat, maxLon, maxLat]
        const bounds = L.latLngBounds(
          [flyTo.bbox[1], flyTo.bbox[0]],
          [flyTo.bbox[3], flyTo.bbox[2]]
        );
        map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 15, duration: 1.2 });
      } else if (typeof flyTo.lat === "number" && typeof flyTo.lon === "number" && !isNaN(flyTo.lat) && !isNaN(flyTo.lon)) {
        map.flyTo([flyTo.lat, flyTo.lon], 13, { duration: 1.2 });
      }
    } catch {
      // Leaflet can throw on hidden/zero-size containers
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
        <>
          <div className="map-style-switcher">
            {(Object.keys(TILE_LAYERS) as MapStyle[]).map((key) => (
              <button
                key={key}
                className={`map-style-btn ${mapStyle === key ? "map-style-btn--active" : ""}`}
                onClick={() => setMapStyle(key)}
                title={t.map.styles[key]}
              >
                <span className="map-style-btn-icon"><MapStyleIcon style={key} /></span>
                <span className="map-style-btn-label">{t.map.styles[key]}</span>
              </button>
            ))}
          </div>
          <div className="map-poi-control" ref={poiRef}>
            <button
              className={`map-poi-btn ${poiCategories.length > 0 ? "map-poi-btn--active" : ""}`}
              onClick={() => setPoiOpen(!poiOpen)}
              title={t.map.poi.label}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>POI</span>
              {poiCategories.length > 0 && <span className="map-poi-badge">{poiCategories.length}</span>}
            </button>
            {poiOpen && (
              <div className="map-poi-menu">
                <div className="map-poi-menu-title">{t.map.poi.label}</div>
                {Object.entries(POI_DEFS).map(([key, def]) => (
                  <button
                    key={key}
                    className={`map-poi-item ${poiCategories.includes(key) ? "map-poi-item--active" : ""}`}
                    onClick={() => {
                      setPoiCategories((prev) =>
                        prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
                      );
                    }}
                  >
                    <span className="map-poi-dot" style={{ background: def.color }} />
                    <span>{def.label}</span>
                  </button>
                ))}
                {poiCategories.length > 0 && (
                  <button className="map-poi-item map-poi-clear" onClick={() => setPoiCategories([])}>
                    {t.map.poi.hideAll}
                  </button>
                )}
                {(mapInstanceRef.current?.getZoom() ?? 0) < 12 && poiCategories.length > 0 && (
                  <div className="map-poi-hint">{t.map.poi.zoomHint}</div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
