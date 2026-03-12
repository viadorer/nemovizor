// ============================================================
// Supabase Database Types – Sreality v3.0.0
// Aktualizujte pomocí: npx supabase gen types typescript
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string;
          slug: string;
          title: string;
          listing_type: Database["public"]["Enums"]["listing_type"];
          category: Database["public"]["Enums"]["property_category"];
          subtype: string;
          rooms_label: string;

          // Cena
          price: number;
          price_note: string | null;
          price_currency: Database["public"]["Enums"]["price_currency"] | null;
          price_unit: Database["public"]["Enums"]["price_unit"] | null;
          price_negotiation: boolean | null;

          // Lokace
          city: string;
          district: string;
          street: string | null;
          zip: string | null;
          region: string | null;
          city_part: string | null;
          location_label: string;
          latitude: number;
          longitude: number;

          // Plochy
          area: number;
          land_area: number | null;
          built_up_area: number | null;
          floor_area: number | null;
          balcony_area: number | null;
          basin_area: number | null;
          cellar_area: number | null;
          garden_area: number | null;
          loggia_area: number | null;
          terrace_area: number | null;
          nolive_total_area: number | null;
          offices_area: number | null;
          production_area: number | null;
          shop_area: number | null;
          store_area: number | null;
          workshop_area: number | null;

          // Popis
          summary: string;
          description: string | null;

          // Stav a parametry
          condition: Database["public"]["Enums"]["property_condition"] | null;
          ownership: Database["public"]["Enums"]["ownership_type"] | null;
          furnishing: Database["public"]["Enums"]["furnishing_type"] | null;
          energy_rating: Database["public"]["Enums"]["energy_rating"] | null;
          building_material: Database["public"]["Enums"]["building_material"] | null;
          flooring: string | null;

          // Topení (multiselect)
          heating: string[] | null;
          heating_element: string[] | null;
          heating_source: string[] | null;
          water_heat_source: string[] | null;

          // Dům specifické
          object_type: Database["public"]["Enums"]["object_type"] | null;
          object_kind: Database["public"]["Enums"]["object_kind"] | null;
          object_location: Database["public"]["Enums"]["object_location"] | null;
          flat_class: Database["public"]["Enums"]["flat_class"] | null;

          // Podlaží
          floor: number | null;
          total_floors: number | null;
          underground_floors: number | null;
          ceiling_height: number | null;

          // Parkování
          parking: Database["public"]["Enums"]["parking_type"] | null;
          parking_spaces: number | null;
          garage_count: number | null;

          // Vybavení (boolean)
          balcony: boolean;
          terrace: boolean;
          garden: boolean;
          elevator: boolean;
          cellar: boolean;
          garage: boolean;
          pool: boolean;
          loggia: boolean;
          easy_access: Database["public"]["Enums"]["easy_access_type"] | null;
          low_energy: boolean | null;
          ftv_panels: boolean | null;
          solar_panels: boolean | null;
          mortgage: boolean | null;

          // Sítě (multiselect)
          electricity: string[] | null;
          gas: string[] | null;
          water: string[] | null;
          gully: string[] | null;
          road_type: string[] | null;
          telecommunication: string[] | null;
          transport: string[] | null;
          internet_connection_type: string[] | null;

          // Internet
          internet_connection_provider: string | null;
          internet_connection_speed: number | null;

          // Okolí
          surroundings_type: Database["public"]["Enums"]["surroundings_type"] | null;
          protection: Database["public"]["Enums"]["protection_type"] | null;

          // Jističe / fáze
          circuit_breaker: Database["public"]["Enums"]["circuit_breaker"] | null;
          phase_distribution: Database["public"]["Enums"]["phase_distribution"] | null;

          // Studna
          well_type: string[] | null;

          // Finanční
          annuity: number | null;
          cost_of_living: string | null;
          commission: number | null;
          mortgage_percent: number | null;
          spor_percent: number | null;
          refundable_deposit: number | null;

          // Pronájem
          lease_type: Database["public"]["Enums"]["lease_type_cb"] | null;
          tenant_not_pay_commission: boolean | null;
          ready_date: string | null;

          // Dražba
          auction_kind: Database["public"]["Enums"]["auction_kind"] | null;
          auction_date: string | null;
          auction_place: string | null;
          price_auction_principal: number | null;
          price_expert_report: number | null;
          price_minimum_bid: number | null;

          // Podíly
          share_numerator: number | null;
          share_denominator: number | null;

          // Stáří
          year_built: number | null;
          last_renovation: number | null;
          acceptance_year: number | null;

          // Výstavba
          beginning_date: string | null;
          finish_date: string | null;
          sale_date: string | null;

          // Prohlídky
          first_tour_date: string | null;

          // Status
          extra_info: Database["public"]["Enums"]["extra_info_status"] | null;
          exclusively_at_rk: boolean | null;
          personal_transfer: Database["public"]["Enums"]["personal_transfer"] | null;

          // Počet vlastníků
          num_owners: number | null;

          // VR / panorama
          matterport_url: string | null;
          mapy_panorama_url: string | null;

          // Klíčová slova
          keywords: string[] | null;

          // Číslo bytové jednotky
          apartment_number: number | null;

          // Média
          image_src: string;
          image_alt: string;
          images: string[];

          // Makléř
          broker_id: string | null;

          // Status
          featured: boolean;
          active: boolean;

          // Timestamps
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["properties"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["properties"]["Insert"]>;
      };
      brokers: {
        Row: {
          id: string;
          name: string;
          phone: string;
          email: string;
          photo: string | null;
          agency_name: string;
          specialization: string;
          active_listings: number;
          rating: number;
          total_deals: number;
          bio: string;
          slug: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["brokers"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["brokers"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      listing_type: "sale" | "rent" | "auction" | "shares";
      property_category: "apartment" | "house" | "land" | "commercial" | "other";
      property_condition: "velmi_dobry" | "dobry" | "spatny" | "ve_vystavbe" | "projekt" | "novostavba" | "k_demolici" | "pred_rekonstrukci" | "po_rekonstrukci" | "v_rekonstrukci";
      building_material: "drevostavba" | "cihla" | "kamen" | "montovana" | "panel" | "skeletal" | "smisena" | "modularni";
      ownership_type: "osobni" | "druzstevni" | "statni";
      furnishing_type: "ano" | "ne" | "castecne";
      energy_rating: "A" | "B" | "C" | "D" | "E" | "F" | "G";
      parking_type: "garaz" | "dvojgaraz" | "trojgaraz" | "podzemni" | "parkovaci_stani" | "zadne";
      object_type: "prizemni" | "patrovy";
      object_kind: "radovy" | "rohovy" | "v_bloku" | "samostatny";
      object_location: "centrum" | "klidna_cast" | "rusna_cast" | "okraj" | "sidliste" | "polosamota" | "samota";
      flat_class: "mezonet" | "loft" | "podkrovni" | "jednopodlazni";
      surroundings_type: "bydleni" | "bydleni_kancelare" | "obchodni" | "administrativni" | "prumyslova" | "venkovska" | "rekreacni" | "rekreacne_nevyuzita";
      protection_type: "ochranne_pasmo" | "narodni_park" | "chko" | "pamatkova_zona" | "pamatkova_rezervace" | "kulturni_pamatka" | "narodni_kulturni_pamatka";
      circuit_breaker: "16a" | "20a" | "25a" | "32a" | "40a" | "50a" | "63a";
      phase_distribution: "1_faze" | "3_faze";
      auction_kind: "nedobrovolna" | "dobrovolna" | "exekucni" | "aukce" | "obchodni_soutez";
      lease_type_cb: "najem" | "podnajem";
      price_currency: "czk" | "usd" | "eur";
      price_unit: "za_nemovitost" | "za_mesic" | "za_m2" | "za_m2_mesic" | "za_m2_rok" | "za_rok" | "za_den" | "za_hodinu" | "za_m2_den" | "za_m2_hodinu";
      extra_info_status: "rezervovano" | "prodano";
      easy_access_type: "ano" | "ne";
      personal_transfer: "ano" | "ne";
    };
  };
}
