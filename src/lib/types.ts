// ============================================================
// Nemovizor – Sreality-kompatibilní typový systém (v3.0.0)
// Číselníky odpovídají oficiálnímu Sreality XML-RPC importu
// ============================================================

// ===== ČÍSELNÍKY =====

/** Typ nabídky (advert_function) */
export const ListingTypes = {
  sale: "Prodej",
  rent: "Pronájem",
  auction: "Dražba",
  project: "Projekt",
  shares: "Podíly",
} as const;
export type ListingType = keyof typeof ListingTypes;

/** Hlavní kategorie nemovitosti (advert_type) */
export const PropertyCategories = {
  apartment: "Byt",
  house: "Dům",
  land: "Pozemek",
  commercial: "Komerční",
  other: "Ostatní",
} as const;
export type PropertyCategory = keyof typeof PropertyCategories;

/** Podtypy – Byty (advert_subtype) */
export const ApartmentSubtypes = {
  "1+kk": "1+kk",
  "1+1": "1+1",
  "2+kk": "2+kk",
  "2+1": "2+1",
  "3+kk": "3+kk",
  "3+1": "3+1",
  "4+kk": "4+kk",
  "4+1": "4+1",
  "5+kk": "5+kk",
  "5+1": "5+1",
  "6+": "6 a více",
  atypicky: "Atypický",
  pokoj: "Pokoj",
} as const;
export type ApartmentSubtype = keyof typeof ApartmentSubtypes;

/** Podtypy – Domy (advert_subtype) */
export const HouseSubtypes = {
  rodinny: "Rodinný",
  vila: "Vila",
  chalupa: "Chalupa",
  chata: "Chata",
  zemedelska_usedlost: "Zemědělská usedlost",
  pamatka: "Památka/jiné",
  na_klic: "Na klíč",
  vicegeneracni: "Vícegenerační dům",
} as const;
export type HouseSubtype = keyof typeof HouseSubtypes;

/** Podtypy – Pozemky (advert_subtype) */
export const LandSubtypes = {
  bydleni: "Bydlení",
  komercni: "Komerční",
  pole: "Pole",
  lesy: "Lesy",
  louky: "Louky",
  zahrady: "Zahrady",
  rybniky: "Rybníky",
  sady_vinice: "Sady/vinice",
  ostatni: "Ostatní",
} as const;
export type LandSubtype = keyof typeof LandSubtypes;

/** Podtypy – Komerční (advert_subtype) */
export const CommercialSubtypes = {
  kancelare: "Kanceláře",
  sklady: "Sklady",
  vyroba: "Výroba",
  obchodni_prostory: "Obchodní prostory",
  ubytovani: "Ubytování",
  restaurace: "Restaurace",
  zemedelsky: "Zemědělský",
  cinzovni_dum: "Činžovní dům",
  virtualni_kancelar: "Virtuální kancelář",
  ordinace: "Ordinace",
  apartmany: "Apartmány",
  ostatni: "Ostatní",
} as const;
export type CommercialSubtype = keyof typeof CommercialSubtypes;

/** Podtypy – Ostatní (advert_subtype) */
export const OtherSubtypes = {
  garaz: "Garáž",
  vinny_sklep: "Vinný sklep",
  pudni_prostor: "Půdní prostor",
  garazove_stani: "Garážové stání",
  mobilheim: "Mobilheim",
  ostatni: "Ostatní",
} as const;
export type OtherSubtype = keyof typeof OtherSubtypes;

/** Stav objektu (building_condition) */
export const PropertyConditions = {
  velmi_dobry: "Velmi dobrý",
  dobry: "Dobrý",
  spatny: "Špatný",
  ve_vystavbe: "Ve výstavbě",
  projekt: "Projekt",
  novostavba: "Novostavba",
  k_demolici: "K demolici",
  pred_rekonstrukci: "Před rekonstrukcí",
  po_rekonstrukci: "Po rekonstrukci",
  v_rekonstrukci: "V rekonstrukci",
} as const;
export type PropertyCondition = keyof typeof PropertyConditions;

/** Materiál stavby (building_type) */
export const BuildingMaterials = {
  drevostavba: "Dřevostavba",
  cihla: "Cihlová",
  kamen: "Kamenná",
  montovana: "Montovaná",
  panel: "Panelová",
  skeletal: "Skeletová",
  smisena: "Smíšená",
  modularni: "Modulární",
} as const;
export type BuildingMaterial = keyof typeof BuildingMaterials;

/** Vlastnictví (ownership) */
export const OwnershipTypes = {
  osobni: "Osobní",
  druzstevni: "Družstevní",
  statni: "Státní/obecní",
} as const;
export type OwnershipType = keyof typeof OwnershipTypes;

/** Vybavení (furnished) */
export const FurnishingTypes = {
  ano: "Ano",
  ne: "Ne",
  castecne: "Částečně",
} as const;
export type FurnishingType = keyof typeof FurnishingTypes;

/** Energetická náročnost budovy (energy_efficiency_rating) */
export const EnergyRatings = {
  A: "A – Mimořádně úsporná",
  B: "B – Velmi úsporná",
  C: "C – Úsporná",
  D: "D – Méně úsporná",
  E: "E – Nehospodárná",
  F: "F – Velmi nehospodárná",
  G: "G – Mimořádně nehospodárná",
} as const;
export type EnergyRating = keyof typeof EnergyRatings;

/** Typ domu (object_type) */
export const ObjectTypes = {
  prizemni: "Přízemní",
  patrovy: "Patrový",
} as const;
export type ObjectType = keyof typeof ObjectTypes;

/** Poloha domu (object_kind) */
export const ObjectKinds = {
  radovy: "Řadový",
  rohovy: "Rohový",
  v_bloku: "V bloku",
  samostatny: "Samostatný",
} as const;
export type ObjectKind = keyof typeof ObjectKinds;

/** Umístění objektu (object_location) */
export const ObjectLocations = {
  centrum: "Centrum obce",
  klidna_cast: "Klidná část obce",
  rusna_cast: "Rušná část obce",
  okraj: "Okraj obce",
  sidliste: "Sídliště",
  polosamota: "Polosamota",
  samota: "Samota",
} as const;
export type ObjectLocation = keyof typeof ObjectLocations;

/** Typ bytu (flat_class) */
export const FlatClasses = {
  mezonet: "Mezonet",
  loft: "Loft",
  podkrovni: "Podkrovní",
  jednopodlazni: "Jednopodlažní",
} as const;
export type FlatClass = keyof typeof FlatClasses;

/** Topení (heating) – multiselect */
export const HeatingTypes = {
  lokalni_plyn: "Lokální plynové",
  lokalni_tuha: "Lokální tuhá paliva",
  lokalni_elektro: "Lokální elektrické",
  ustredni_plyn: "Ústřední plynové",
  ustredni_tuha: "Ústřední tuhá paliva",
  ustredni_elektro: "Ústřední elektrické",
  ustredni_dalkove: "Ústřední dálkové",
  jine: "Jiné",
  podlahove: "Podlahové",
} as const;
export type HeatingType = keyof typeof HeatingTypes;

/** Topné těleso (heating_element) – multiselect */
export const HeatingElements = {
  waw: "WAW",
  podlahove_vytapeni: "Podlahové vytápění",
  radiatory: "Radiátory",
  primotop: "Přímotop",
  infrapanel: "Infrapanel",
  krbova_kamna: "Krbová kamna",
  krb: "Krb",
  kotel_tuha: "Kotel na tuhá paliva",
  kamna: "Kamna",
} as const;
export type HeatingElement = keyof typeof HeatingElements;

/** Zdroj topení (heating_source) – multiselect */
export const HeatingSources = {
  waw: "WAW",
  plyn_kondenzacni: "Plynový kondenzační kotel",
  plyn_kotel: "Plynový kotel",
  elektrokotel: "Elektrokotel",
  tepelne_cerpadlo: "Tepelné čerpadlo",
  primotop: "Přímotop",
  infrapanel: "Infrapanel",
  krbova_kamna: "Krbová kamna",
  krb: "Krb",
  kotel_tuha: "Kotel na tuhá paliva",
  kamna: "Kamna",
  ustredni_dalkove: "Ústřední dálkové",
} as const;
export type HeatingSource = keyof typeof HeatingSources;

/** Zdroj teplé vody (water_heat_source) – multiselect */
export const WaterHeatSources = {
  plyn_kondenzacni: "Plynový kondenzační kotel",
  plyn_kotel: "Plynový kotel",
  elektrokotel: "Elektrokotel",
  tepelne_cerpadlo: "Tepelné čerpadlo",
  plyn_karma: "Plynová karma",
  kotel_tuha: "Kotel na tuhá paliva",
} as const;
export type WaterHeatSource = keyof typeof WaterHeatSources;

/** Elektřina (electricity) – multiselect */
export const ElectricityTypes = {
  "120v": "120V",
  "230v": "230V",
  "400v": "400V",
  bez_pripojky: "Bez přípojky",
} as const;
export type ElectricityType = keyof typeof ElectricityTypes;

/** Plyn (gas) – multiselect */
export const GasTypes = {
  individualni: "Individuální",
  plynovod: "Plynovod",
} as const;
export type GasType = keyof typeof GasTypes;

/** Voda (water) – multiselect */
export const WaterTypes = {
  mistni_zdroj: "Místní zdroj vody",
  vodovod: "Vodovod",
  studna: "Studna",
  retencni_nadrz: "Retenční nádrž na dešťovou vodu",
} as const;
export type WaterType = keyof typeof WaterTypes;

/** Odpad (gully) – multiselect */
export const GullyTypes = {
  verejna_kanalizace: "Veřejná kanalizace",
  cov: "ČOV pro celý objekt",
  septik: "Septik",
  jimka: "Jímka",
  trativod: "Trativod",
} as const;
export type GullyType = keyof typeof GullyTypes;

/** Komunikace (road_type) – multiselect */
export const RoadTypes = {
  betonova: "Betonová",
  dlazdena: "Dlážděná",
  asfaltova: "Asfaltová",
  neupravena: "Neupravená",
  zpevnena: "Zpevněná",
  sterkova: "Štěrková",
  sotolina: "Šotolina",
  neni_komunikace: "Není příjezdová komunikace",
} as const;
export type RoadType = keyof typeof RoadTypes;

/** Telekomunikace (telecommunication) – multiselect */
export const TelecommunicationTypes = {
  telefon: "Telefon",
  internet: "Internet",
  satelit: "Satelit",
  kabelova_tv: "Kabelová televize",
  kabelove_rozvody: "Kabelové rozvody",
  ostatni: "Ostatní",
} as const;
export type TelecommunicationType = keyof typeof TelecommunicationTypes;

/** Doprava (transport) – multiselect */
export const TransportTypes = {
  vlak: "Vlak",
  dalnice: "Dálnice",
  silnice: "Silnice",
  mhd: "MHD",
  autobus: "Autobus",
} as const;
export type TransportType = keyof typeof TransportTypes;

/** Zástavba (surroundings_type) */
export const SurroundingsTypes = {
  bydleni: "Bydlení",
  bydleni_kancelare: "Bydlení a kanceláře",
  obchodni: "Obchodní",
  administrativni: "Administrativní",
  prumyslova: "Průmyslová",
  venkovska: "Venkovská",
  rekreacni: "Rekreační",
  rekreacne_nevyuzita: "Rekreačně nevyužitá",
} as const;
export type SurroundingsType = keyof typeof SurroundingsTypes;

/** Ochrana (protection) */
export const ProtectionTypes = {
  ochranne_pasmo: "Ochranné pásmo",
  narodni_park: "Národní park",
  chko: "CHKO",
  pamatkova_zona: "Památková zóna",
  pamatkova_rezervace: "Památková rezervace",
  kulturni_pamatka: "Kulturní památka",
  narodni_kulturni_pamatka: "Národní kulturní památka",
} as const;
export type ProtectionType = keyof typeof ProtectionTypes;

/** Jističe (circuit_breaker) */
export const CircuitBreakers = {
  "16a": "16A",
  "20a": "20A",
  "25a": "25A",
  "32a": "32A",
  "40a": "40A",
  "50a": "50A",
  "63a": "63A",
} as const;
export type CircuitBreaker = keyof typeof CircuitBreakers;

/** Typ internetového připojení (internet_connection_type) – multiselect */
export const InternetConnectionTypes = {
  adsl: "ADSL",
  vdsl: "VDSL",
  optika: "Optika",
  vzduchem: "Vzduchem",
} as const;
export type InternetConnectionType = keyof typeof InternetConnectionTypes;

/** Typ studny (well_type) – multiselect */
export const WellTypes = {
  vrtana: "Vrtaná studna",
  kopana: "Kopaná studna",
} as const;
export type WellType = keyof typeof WellTypes;

/** Druh dražby (auction_kind) */
export const AuctionKinds = {
  nedobrovolna: "Nedobrovolná",
  dobrovolna: "Dobrovolná",
  exekucni: "Exekuční dražba",
  aukce: "Aukce",
  obchodni_soutez: "Obchodní veřejná soutěž",
} as const;
export type AuctionKind = keyof typeof AuctionKinds;

/** Typ pronájmu (lease_type_cb) */
export const LeaseTypes = {
  najem: "Nájem",
  podnajem: "Podnájem",
} as const;
export type LeaseType = keyof typeof LeaseTypes;

/** Měna (advert_price_currency) */
export const PriceCurrencies = {
  czk: "Kč",
  usd: "USD",
  eur: "EUR",
  gbp: "GBP",
} as const;
export type PriceCurrency = keyof typeof PriceCurrencies;

/** Jednotka ceny (advert_price_unit) */
export const PriceUnits = {
  za_nemovitost: "Za nemovitost",
  za_mesic: "Za měsíc",
  za_m2: "Za m²",
  za_m2_mesic: "Za m²/měsíc",
  za_m2_rok: "Za m²/rok",
  za_rok: "Za rok",
  za_den: "Za den",
  za_hodinu: "Za hodinu",
  za_m2_den: "Za m²/den",
  za_m2_hodinu: "Za m²/hodinu",
} as const;
export type PriceUnit = keyof typeof PriceUnits;

/** Stav inzerátu (extra_info) */
export const ExtraInfoStatuses = {
  rezervovano: "Rezervováno",
  prodano: "Prodáno",
} as const;
export type ExtraInfoStatus = keyof typeof ExtraInfoStatuses;

/** Bezbariérový (easy_access) */
export const EasyAccessTypes = {
  ano: "Ano",
  ne: "Ne",
} as const;
export type EasyAccessType = keyof typeof EasyAccessTypes;

/** Převod do OV (personal) */
export const PersonalTransferTypes = {
  ano: "Ano",
  ne: "Ne",
} as const;
export type PersonalTransferType = keyof typeof PersonalTransferTypes;

/** Počet fází (phase_distributions) */
export const PhaseDistributions = {
  "1_faze": "1 fáze",
  "3_faze": "3 fáze",
} as const;
export type PhaseDistribution = keyof typeof PhaseDistributions;

/** Počet pokojů (advert_room_count) – povinné pro Domy */
export const RoomCounts = {
  "1": "1 pokoj",
  "2": "2 pokoje",
  "3": "3 pokoje",
  "4": "4 pokoje",
  "5+": "5 a více pokojů",
  atypicky: "Atypický",
} as const;
export type RoomCount = keyof typeof RoomCounts;

/** Typ místnosti pro fotografie (room_type) */
export const RoomTypes = {
  obyvaci_pokoj: "Obývací pokoj",
  obyvaci_s_jidelnou: "Obývací pokoj s jídelnou",
  jidelna: "Jídelna",
  pokoj_loznice: "Pokoj/Ložnice",
  kuchyne: "Kuchyně",
  koupelna: "Koupelna",
  pradelna: "Prádelna",
  schodiste: "Schodiště",
  recepce: "Recepce/vstupní hala",
  hala_chodba: "Hala/Chodba",
  sklad_spiz: "Sklad/spíž",
  kancelar: "Kancelář",
  satna: "Šatna",
  posilovna: "Posilovna",
  prazdna_mistnost: "Prázdná místnost",
  balkon: "Balkón",
  terasa: "Terasa",
  sklep: "Sklep",
  zahrada: "Zahrada",
  bazen: "Bazén",
  parkovani: "Parkování",
  pudorys_2d: "2D půdorys",
  pudorys_3d: "3D půdorys",
  dokumenty: "Dokumenty",
  energeticky_stitek: "Energetický štítek",
  umisteni_mapa: "Umístění na mapě",
  nesouvisejici: "Nesouvisející",
  venkovni_budova: "Venkovní budova",
  venkovni_dum: "Venkovní dům",
  detaily: "Detaily",
  pohled_na_vodu: "Pohled na vodu",
  vyhled_na_hory: "Výhled na hory",
} as const;
export type RoomType = keyof typeof RoomTypes;

/** Typ parkování */
export const ParkingTypes = {
  garaz: "Garáž",
  dvojgaraz: "Dvojgaráž",
  trojgaraz: "Trojgaráž",
  podzemni: "Podzemní garáž",
  parkovaci_stani: "Parkovací stání",
  zadne: "Bez parkování",
} as const;
export type ParkingType = keyof typeof ParkingTypes;

/** Typ podlahy (floors – developerský projekt) */
export const FloorTypes = {
  koberec: "Koberec",
  plovouci_laminat: "Plovoucí laminátové",
  plovouci_drevo: "Plovoucí dřevěné",
  parkety: "Dřevěné parkety",
  marmoleum: "Marmoleum",
  vinyl: "Vinylové",
  linoleum: "Linoleum",
  korek: "Korek",
  dlazba: "Dlažba",
  beton: "Betonová",
  ostatni: "Ostatní",
} as const;
export type FloorType = keyof typeof FloorTypes;

// ===== HLAVNÍ TYPY =====

/** Nemovitost – plná struktura (Sreality-kompatibilní v3.0.0) */
export type Property = {
  // Identifikace
  id: string;
  slug: string;

  // Základní info
  title: string;
  listingType: ListingType;
  category: PropertyCategory;
  subtype: string;
  roomsLabel: string; // dispozice: "3+kk", "5+1"

  // Cena
  price: number;
  priceNote?: string;
  priceCurrency?: PriceCurrency;
  priceUnit?: PriceUnit;
  priceNegotiation?: boolean;

  // Lokace
  city: string;
  district: string;
  street?: string;
  zip?: string;
  region?: string;
  cityPart?: string;
  country?: string;
  locationLabel: string;
  latitude: number;
  longitude: number;

  // Plochy
  area: number; // užitná plocha m²
  landArea?: number; // plocha pozemku
  builtUpArea?: number; // zastavěná plocha
  floorArea?: number; // celková plocha
  balconyArea?: number;
  basinArea?: number;
  cellarArea?: number;
  gardenArea?: number;
  loggiaArea?: number;
  terraceArea?: number;
  noliveTotalArea?: number; // plocha nebytových prostor
  officesArea?: number;
  productionArea?: number;
  shopArea?: number;
  storeArea?: number;
  workshopArea?: number;

  // Popis
  summary: string;
  description?: string;

  // Stav a parametry
  condition: string;
  ownership: string;
  furnishing: string;
  energyRating: string;
  buildingMaterial?: string;
  heating?: string[];
  heatingElement?: string[];
  heatingSource?: string[];
  waterHeatSource?: string[];
  flooring?: string;

  // Dům specifické
  objectType?: ObjectType;
  objectKind?: ObjectKind;
  objectLocation?: ObjectLocation;
  flatClass?: FlatClass;

  // Podlaží
  floor?: number;
  totalFloors?: number;
  undergroundFloors?: number;
  ceilingHeight?: number;

  // Parkování
  parking: string;
  parkingSpaces?: number;
  garageCount?: number;

  // Vybavení / vlastnosti (boolean)
  balcony: boolean;
  terrace: boolean;
  garden: boolean;
  elevator: boolean;
  cellar: boolean;
  garage: boolean;
  pool: boolean;
  loggia: boolean;
  easyAccess?: boolean;
  lowEnergy?: boolean;
  ftvPanels?: boolean;
  solarPanels?: boolean;
  mortgage?: boolean;

  // Sítě (multiselect)
  electricity?: string[];
  gas?: string[];
  water?: string[];
  gully?: string[];
  roadType?: string[];
  telecommunication?: string[];
  transport?: string[];
  internetConnectionType?: string[];

  // Internet
  internetConnectionProvider?: string;
  internetConnectionSpeed?: number;

  // Okolí
  surroundingsType?: SurroundingsType;
  protection?: ProtectionType;

  // Jističe / fáze
  circuitBreaker?: CircuitBreaker;
  phaseDistribution?: PhaseDistribution;

  // Studna
  wellType?: string[];

  // Finanční
  annuity?: number;
  costOfLiving?: string;
  commission?: number;
  mortgagePercent?: number;
  sporPercent?: number;
  refundableDeposit?: number;

  // Pronájem specifické
  leaseType?: LeaseType;
  tenantNotPayCommission?: boolean;
  readyDate?: string;

  // Dražba specifické
  auctionKind?: AuctionKind;
  auctionDate?: string;
  auctionPlace?: string;
  priceAuctionPrincipal?: number;
  priceExpertReport?: number;
  priceMinimumBid?: number;

  // Podíly
  shareNumerator?: number;
  shareDenominator?: number;

  // Stáří
  yearBuilt?: number;
  lastRenovation?: number;
  acceptanceYear?: number;

  // Výstavba
  beginningDate?: string;
  finishDate?: string;
  saleDate?: string;

  // Prohlídky
  firstTourDate?: string;

  // Status inzerátu
  extraInfo?: ExtraInfoStatus;
  exclusivelyAtRk?: boolean;
  personalTransfer?: PersonalTransferType;

  // Počet vlastníků
  numOwners?: number;

  // VR / panorama
  matterportUrl?: string;
  mapyPanoramaUrl?: string;

  // Klíčová slova
  keywords?: string[];

  // Číslo bytové jednotky
  apartmentNumber?: number;

  // Média
  imageSrc: string;
  imageAlt: string;
  images: string[];
  videoUrl?: string;

  // Body zájmu
  pointsOfInterest?: PointOfInterest[];

  // Makléř
  brokerName: string;
  brokerPhone: string;
  brokerEmail: string;
  brokerPhoto?: string;
  agencyName: string;
  showAgencyLogo?: boolean;
  brokerId?: string;

  // Statistiky
  views?: number;
  viewsTrend?: "hot" | "warm" | "normal";

  // Status
  featured: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/** Filtry vyhledávání */
export type PropertyFilters = {
  city?: string;
  category?: PropertyCategory;
  listingType?: ListingType;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  roomsLabel?: string;
  condition?: string;
  ownership?: string;
  buildingMaterial?: string;
  objectLocation?: string;
  furnishing?: string;
  energyRating?: string;
  subtype?: string;
};

/** Uložené hledání */
export type SavedSearch = {
  id: string;
  name: string;
  filters: {
    listingType?: string | null;
    category?: string | null;
    categories?: string[];
    subtype?: string | null;
    subtypes?: string[];
    city?: string | null;
    priceMin?: number | null;
    priceMax?: number | null;
    areaMin?: number | null;
    areaMax?: number | null;
    sortBy?: string | null;
  };
  locationLabel?: string | null;
  createdAt: string;
  lastUsedAt?: string;
};

/** Makléř */
export type Broker = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  photo?: string;
  agencyId: string;
  agencyName: string;
  specialization: string;
  activeListings: number;
  rating: number;
  totalDeals: number;
  bio: string;
  languages?: string[];
  certifications?: string[];
  yearStarted?: number;
};

/** Realitní kancelář */
export type Agency = {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  description: string;
  phone: string;
  email: string;
  website?: string;
  foundedYear: number;
  totalBrokers: number;
  totalListings: number;
  totalDeals: number;
  rating: number;
  specializations: string[];
  parentAgencyId?: string;
  isIndependent: boolean;
  seatCity?: string;
  seatAddress?: string;
};

/** Pobočka kanceláře */
export type Branch = {
  id: string;
  agencyId: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  latitude: number;
  longitude: number;
  isHeadquarters: boolean;
};

/** Hodnocení makléře nebo kanceláře */
export type Review = {
  id: string;
  targetType: "broker" | "agency";
  targetId: string;
  authorName: string;
  rating: number;
  text: string;
  date: string;
  propertyType?: string;
};

// ===== BODY ZAJMU =====

export type PointOfInterestCategory =
  | "school"
  | "transport"
  | "shop"
  | "restaurant"
  | "park"
  | "health"
  | "sport"
  | "culture";

export type PointOfInterest = {
  name: string;
  category: PointOfInterestCategory;
  distance: number; // metry
  walkMinutes?: number;
};

// ===== HELPER: číselník → pole options pro dropdown =====
export function enumToOptions<T extends Record<string, string>>(
  enumObj: T
): { value: keyof T & string; label: string }[] {
  return Object.entries(enumObj).map(([value, label]) => ({
    value: value as keyof T & string,
    label: label as string,
  }));
}
