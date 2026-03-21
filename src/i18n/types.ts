/**
 * TypeScript interface pro překlady.
 * Každý jazykový soubor (cs.ts, en.ts, ...) MUSÍ implementovat celý interface.
 * Chybějící klíč = compile error.
 */

export interface Translation {
  // ===== NAVIGACE =====
  nav: {
    home: string;
    listings: string;
    brokers: string;
    agencies: string;
    valuation: string;
    sell: string;
    login: string;
    register: string;
    dashboard: string;
    favorites: string;
    savedSearches: string;
    myListings: string;
    profile: string;
    logout: string;
  };

  // ===== HERO =====
  hero: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    searchButton: string;
    stats: {
      properties: string;
      cities: string;
      brokers: string;
      aiSearch: string;
      alerts: string;
    };
    statsPrefix: string;
    statsSuffix: string;
  };

  // ===== KATEGORIE =====
  categories: {
    apartment: string;
    house: string;
    land: string;
    commercial: string;
    other: string;
    apartmentDesc: string;
    houseDesc: string;
    landDesc: string;
    commercialDesc: string;
  };

  // ===== HOMEPAGE =====
  homepage: {
    searchingTitle: string;
    latestTitle: string;
    popularLocations: string;
    listingsCount: string;
    step1Title: string;
    step1Desc: string;
    step1Link: string;
    step2Title: string;
    step2Desc: string;
    step2Link: string;
    step3Title: string;
    step3Desc: string;
    step3Link: string;
    ctaTitle: string;
    ctaSubtitle: string;
    ctaValuation: string;
    ctaSpecialist: string;
  };

  // ===== FILTRY =====
  filters: {
    listingType: string;
    category: string;
    subtype: string;
    city: string;
    priceFrom: string;
    priceTo: string;
    areaFrom: string;
    areaTo: string;
    condition: string;
    ownership: string;
    material: string;
    furnishing: string;
    energy: string;
    location: string;
    country: string;
    rooms: string;
    moreFilters: string;
    resetFilters: string;
    applyFilters: string;
    allTypes: string;
    allCategories: string;
    allCountries: string;
    all: string;
    price: string;
    area: string;
    searchLocation: string;
    floor: string;
    floorFrom: string;
    floorTo: string;
  };

  // ===== ŘAZENÍ =====
  sort: {
    label: string;
    recommended: string;
    newest: string;
    oldest: string;
    priceAsc: string;
    priceDesc: string;
    areaAsc: string;
    areaDesc: string;
  };

  // ===== VÝSLEDKY =====
  results: {
    found: string;
    tipListings: string;
    noResults: string;
    noResultsHint: string;
    showing: string;
    loadMore: string;
    offerOne: string;
    offerFew: string;
    offerMany: string;
    inArea: string;
    page: string;
    listView: string;
    gridView: string;
    mapView: string;
  };

  // ===== TYP NABÍDKY =====
  listingTypes: {
    sale: string;
    rent: string;
    auction: string;
    project: string;
    shares: string;
  };

  // ===== BADGE =====
  badges: {
    premium: string;
    tip: string;
    new: string;
    reduced: string;
    reserved: string;
    sold: string;
  };

  // ===== KARTA NEMOVITOSTI =====
  propertyCard: {
    perMonth: string;
    priceOnRequest: string;
    noPhoto: string;
    rooms: string;
    area: string;
  };

  // ===== DETAIL NEMOVITOSTI =====
  detail: {
    description: string;
    parameters: string;
    features: string;
    equipment: string;
    location: string;
    poi: string;
    broker: string;
    agency: string;
    contactBroker: string;
    callBroker: string;
    emailBroker: string;
    similarProperties: string;
    backToListings: string;
    share: string;
    print: string;
    report: string;
    gallery: string;
    videoTour: string;
    virtualTour: string;
    floorPlan: string;
    yearBuilt: string;
    lastRenovation: string;
    floor: string;
    totalFloors: string;
    ceilingHeight: string;
    parking: string;
    parkingSpaces: string;
    pricePerM2: string;
    monthlyCharges: string;
    commission: string;
    // Detail page labels
    district: string;
    cityPart: string;
    zip: string;
    region: string;
    undergroundFloors: string;
    acceptanceYear: string;
    ownerCount: string;
    apartmentNumber: string;
    share_fraction: string;
    mortgagePossible: string;
    exclusiveAtRk: string;
    internetProvider: string;
    internetSpeed: string;
    circuitBreaker: string;
    phaseDistribution: string;
    wellType: string;
    priceNote: string;
    priceIs: string;
    priceNegotiable: string;
    annuity: string;
    livingCosts: string;
    commissionFee: string;
    refundableDeposit: string;
    mortgagePercent: string;
    sporPercent: string;
    leaseType: string;
    moveInDate: string;
    tenantNoCommission: string;
    auctionKind: string;
    auctionDate: string;
    auctionPlace: string;
    auctionDeposit: string;
    expertReport: string;
    minimumBid: string;
    constructionStart: string;
    completionDate: string;
    saleDate: string;
    firstTour: string;
    infrastructure: string;
    financialInfo: string;
    dates: string;
    keywords: string;
    perYear: string;
    viewBrokerProfile: string;
    viewAgencyProfile: string;
    locality: string;
  };

  // ===== GALERIE =====
  gallery: {
    photos: string;
    video: string;
    tour3d: string;
    photoGallery: string;
    previous: string;
    next: string;
    videoTour: string;
    close: string;
    showPhoto: string;
    morePhotos: string;
    thumbnail: string;
    videoNotSupported: string;
  };

  // ===== POI =====
  poiSection: {
    title: string;
    culture: string;
    parksAndNature: string;
  };

  // ===== PARAMETRY =====
  params: {
    area: string;
    landArea: string;
    builtUpArea: string;
    floorArea: string;
    balconyArea: string;
    cellarArea: string;
    gardenArea: string;
    loggiaArea: string;
    terraceArea: string;
    condition: string;
    ownership: string;
    material: string;
    furnishing: string;
    energyRating: string;
    objectType: string;
    objectKind: string;
    objectLocation: string;
    flatClass: string;
    heating: string;
    heatingElement: string;
    heatingSource: string;
    waterHeatSource: string;
    flooring: string;
    electricity: string;
    gas: string;
    water: string;
    gully: string;
    roadType: string;
    telecommunication: string;
    transport: string;
    internet: string;
    surroundings: string;
    protection: string;
  };

  // ===== VLASTNOSTI (boolean) =====
  features: {
    balcony: string;
    terrace: string;
    garden: string;
    elevator: string;
    cellar: string;
    garage: string;
    pool: string;
    loggia: string;
    easyAccess: string;
    lowEnergy: string;
    ftvPanels: string;
    solarPanels: string;
  };

  // ===== MAPA =====
  map: {
    styles: {
      dark: string;
      standard: string;
      satellite: string;
    };
    poi: {
      label: string;
      school: string;
      transport: string;
      shop: string;
      restaurant: string;
      health: string;
      sport: string;
      park: string;
      hideAll: string;
      zoomHint: string;
      transportStop: string;
    };
    detailLink: string;
  };

  // ===== ULOŽENÁ HLEDÁNÍ (panel) =====
  savedSearchPanel: {
    trigger: string;
    title: string;
    saveCurrent: string;
    empty: string;
    emptyHint: string;
    deleteTitle: string;
  };

  // ===== VYHLEDÁVÁNÍ LOKALITY =====
  locationSearch: {
    placeholder: string;
    citiesWithListings: string;
    listingsCount: string;
  };

  // ===== LOKALITY =====
  localities: {
    label: string;
    title: string;
  };

  // ===== ADMIN =====
  admin: {
    search: string;
    actions: string;
    loading: string;
    noRecords: string;
    recordsCount: string;
    pageOf: string;
    saving: string;
    saved: string;
    redirecting: string;
    notFound: string;
    loadError: string;
    saveError: string;
    nameRequired: string;
    slugRequired: string;
    createAgency: string;
    saveChanges: string;
    agencyName: string;
    agencyNamePlaceholder: string;
    slug: string;
    email: string;
    phone: string;
    website: string;
    seatCity: string;
    seatAddress: string;
    description: string;
    descriptionPlaceholder: string;
    logo: string;
    foundedYear: string;
    specializations: string;
    specializationPlaceholder: string;
    parentAgency: string;
    parentAgencyNone: string;
    independentAgency: string;
    // Shared admin strings
    back: string;
    selectPlaceholder: string;
    loadingData: string;
    createdSuccess: string;
    editedSuccess: string;
    // Broker form
    brokerName: string;
    brokerNamePlaceholder: string;
    agency: string;
    agencyPlaceholder: string;
    branch: string;
    branchPlaceholder: string;
    profilePhoto: string;
    bio: string;
    bioPlaceholder: string;
    specialization: string;
    specializationPlaceholder2: string;
    yearStarted: string;
    languages: string;
    languagesPlaceholder: string;
    certifications: string;
    certificationsPlaceholder: string;
    createBroker: string;
    editBroker: string;
    newBroker: string;
    brokerCreated: string;
    brokerSaved: string;
    // Property form
    listingType: string;
    category: string;
    subtype: string;
    disposition: string;
    dispositionPlaceholder: string;
    listingTitle: string;
    listingTitlePlaceholder: string;
    slugUrl: string;
    generateFromTitle: string;
    titleRequired: string;
    listingTypeRequired: string;
    categoryRequired: string;
    priceRequired: string;
    cityRequired: string;
    price: string;
    priceCurrency: string;
    priceUnit: string;
    priceNegotiable: string;
    priceNote: string;
    priceNotePlaceholder: string;
    basicInfoAndPrice: string;
    locationSection: string;
    city: string;
    district: string;
    street: string;
    cityPart: string;
    zip: string;
    region: string;
    locationLabel: string;
    locationLabelPlaceholder: string;
    latitude: string;
    longitude: string;
    descriptionAndMedia: string;
    summary: string;
    summaryPlaceholder: string;
    detailedDescription: string;
    detailedDescriptionPlaceholder: string;
    photos: string;
    mainPhoto: string;
    altText: string;
    altTextPlaceholder: string;
    virtualTours: string;
    matterportUrl: string;
    mapyPanoramaUrl: string;
    parameters: string;
    areas: string;
    usableArea: string;
    landArea: string;
    builtUpArea: string;
    totalArea: string;
    balconyArea: string;
    loggiaArea: string;
    terraceArea: string;
    gardenArea: string;
    cellarArea: string;
    basinArea: string;
    officesArea: string;
    productionArea: string;
    shopArea: string;
    storageArea: string;
    workshopArea: string;
    nonResidentialTotal: string;
    conditionAndParams: string;
    objectCondition: string;
    ownership: string;
    furnishing: string;
    energyLabel: string;
    buildingMaterial: string;
    flooring: string;
    flooringPlaceholder: string;
    houseApartmentSpecific: string;
    houseType: string;
    housePosition: string;
    objectPlacement: string;
    apartmentType: string;
    floors: string;
    floor: string;
    totalFloors: string;
    undergroundFloors: string;
    ceilingHeight: string;
    parkingSection: string;
    parkingType: string;
    parkingSpaces: string;
    garageCount: string;
    equipmentAndFeatures: string;
    balconyLabel: string;
    terraceLabel: string;
    gardenLabel: string;
    elevatorLabel: string;
    cellarLabel: string;
    garageLabel: string;
    poolLabel: string;
    loggiaLabel: string;
    lowEnergyLabel: string;
    ftvPanelsLabel: string;
    solarPanelsLabel: string;
    mortgagePossible: string;
    barrierFreeAccess: string;
    age: string;
    yearBuilt: string;
    lastRenovation: string;
    acceptanceYear: string;
    extendedInfo: string;
    heating: string;
    heatingType: string;
    heatingElement: string;
    heatingSource: string;
    hotWaterSource: string;
    infrastructure: string;
    electricity: string;
    gas: string;
    water: string;
    sewage: string;
    roads: string;
    telecom: string;
    transport: string;
    internet: string;
    internetProvider: string;
    internetProviderPlaceholder: string;
    internetSpeed: string;
    developmentType: string;
    protection: string;
    circuitBreaker: string;
    phase: string;
    wellType: string;
    financialInfo: string;
    annuity: string;
    livingCosts: string;
    livingCostsPlaceholder: string;
    commissionLabel: string;
    mortgagePercent: string;
    savingsPercent: string;
    refundableDeposit: string;
    rentalAuctionShares: string;
    rental: string;
    rentalHint: string;
    leaseType: string;
    tenantNoCommission: string;
    moveInDate: string;
    auction: string;
    auctionHint: string;
    auctionType: string;
    auctionDate: string;
    auctionPlace: string;
    auctionPlacePlaceholder: string;
    auctionDeposit: string;
    expertReportPrice: string;
    minimumBid: string;
    shares: string;
    sharesHint: string;
    shareNumerator: string;
    shareNumeratorPlaceholder: string;
    shareDenominator: string;
    shareDenominatorPlaceholder: string;
    datesAndStatus: string;
    constructionStart: string;
    constructionEnd: string;
    saleDate: string;
    firstTour: string;
    status: string;
    personalTransfer: string;
    exclusiveAtRk: string;
    ownerCount: string;
    apartmentNumber: string;
    keywords: string;
    keywordsPlaceholder: string;
    brokerAndPublication: string;
    assignedBroker: string;
    assignedBrokerNone: string;
    assignToBroker: string;
    project: string;
    projectNone: string;
    activeOnWeb: string;
    featuredPremium: string;
    createProperty: string;
    editProperty: string;
    newProperty: string;
    propertyCreated: string;
    propertySaved: string;
    propertyLoadError: string;
    // Image dropzone
    dropzoneText: string;
    dropzoneHint: string;
    setAsMain: string;
    moveUp: string;
    moveDown: string;
    removeImage: string;
    pasteUrlPlaceholder: string;
    addUrl: string;
    uploadError: string;
    // Single image upload
    allowedFormats: string;
    maxFileSize: string;
    dragOrClick: string;
    change: string;
    remove: string;
    uploadErrorGeneric: string;
    // Confirm dialog
    confirmDefault: string;
    cancelLabel: string;
    // Form fields
    addPlaceholder: string;
    // Headquarters suffix
    headquartersSuffix: string;
  };

  // ===== DASHBOARD =====
  dashboard: {
    title: string;
    overview: string;
    favorites: string;
    savedSearches: string;
    history: string;
    notifications: string;
    myListings: string;
    myStructure: string;
    inquiries: string;
    addListing: string;
    messages: string;
    settings: string;
    profile: string;
    analytics: string;
    subscription: string;
    projects: string;
    scraper: string;
    // Dividers
    brokerSection: string;
    adminSection: string;
    // Admin
    adminUsers: string;
    adminListings: string;
    adminBrokers: string;
    adminAgencies: string;
    // Dashboard page content
    greeting: string;
    welcomeMessage: string;
    favoritesCount: string;
    savedSearchesCount: string;
    recentSearchesCount: string;
    browseListings: string;
    // Favorites page
    favoritesTitle: string;
    favoritesEmpty: string;
    removeFromFavorites: string;
    // Saved searches page
    savedSearchesTitle: string;
    savedSearchesEmpty: string;
    searchProperties: string;
    useSearch: string;
    turnOffNotifications: string;
    turnOnNotifications: string;
    // History page
    historyTitle: string;
    historyEmpty: string;
    clearAll: string;
    repeatSearch: string;
    resultsCount: string;
    // Settings page
    settingsTitle: string;
    avatarHint: string;
    emailLabel: string;
    fullNameLabel: string;
    phoneLabel: string;
    preferredCityLabel: string;
    preferredCityPlaceholder: string;
    saving: string;
    saveChanges: string;
    saved: string;
    maxFileSize: string;
    // Notifications page
    notificationsTitle: string;
    notificationsInfoBanner: string;
    globalSettings: string;
    emailNotifications: string;
    emailNotificationsDesc: string;
    pushNotifications: string;
    pushNotificationsSoon: string;
    savedSearchNotifications: string;
    frequencyInstant: string;
    frequencyDaily: string;
    frequencyWeekly: string;
    // Requests (poptavky) page
    requestsTitle: string;
    requestsSearchPlaceholder: string;
    requestClientLabel: string;
    requestPhoneLabel: string;
    requestTypeLabel: string;
    requestStatusLabel: string;
    requestMessageLabel: string;
    requestDateLabel: string;
    requestTypeInfo: string;
    requestTypeViewing: string;
    requestTypeOffer: string;
    requestTypeValuation: string;
    requestStatusNew: string;
    requestStatusContacted: string;
    requestStatusClosed: string;
    // My analytics page
    myAnalyticsTitle: string;
    totalListings: string;
    activeCount: string;
    totalRequests: string;
    newCount: string;
    tipStatsTitle: string;
    tipImpressions: string;
    tipClicks: string;
    tipContacts: string;
    tipActive: string;
    tipExpiresLabel: string;
    tipNoActive: string;
    last7days: string;
    // My listings page
    myListingsTitle: string;
    myListingsSearchPlaceholder: string;
    listingNameLabel: string;
    listingNoTitle: string;
    listingPriceLabel: string;
    listingTypeLabel: string;
    listingStateLabel: string;
    listingStateActive: string;
    listingStateInactive: string;
    listingCreatedLabel: string;
    newProperty: string;
    // Admin analytics page
    adminAnalyticsTitle: string;
    adminTotalProperties: string;
    adminProjects: string;
    adminBrokersLabel: string;
    adminAgenciesLabel: string;
    adminUsersLabel: string;
    adminFavorites: string;
    adminSavedSearches: string;
    // Admin projects page
    adminProjectsTitle: string;
    adminProjectsSearchPlaceholder: string;
    projectNameLabel: string;
    projectCityLabel: string;
    projectStatusLabel: string;
    projectUnitsLabel: string;
    projectPriceFromLabel: string;
    projectStateLabel: string;
    projectDeleteBtn: string;
    projectDeleteTitle: string;
    projectDeleteMessage: string;
    projectStatusPlanned: string;
    projectStatusActive: string;
    projectStatusConstruction: string;
    projectStatusSelling: string;
    projectStatusCompleted: string;
    projectStatusArchived: string;
    // Admin scraper page
    scraperTitle: string;
    scraperStatusLabel: string;
    scraperCliMessage: string;
    scraperRunCommand: string;
    scraperRunHistoryTitle: string;
    scraperSearchPlaceholder: string;
    scraperStartedAt: string;
    scraperSource: string;
    scraperStatus: string;
    scraperScraped: string;
    scraperInserted: string;
    scraperUpdated: string;
    scraperErrors: string;
    scraperDuration: string;
    scraperRunning: string;
    // Admin table pages
    adminBrokersTitle: string;
    adminBrokersSearch: string;
    adminBrokersNewBtn: string;
    adminBrokersArchiveTitle: string;
    adminBrokersArchiveMessage: string;
    adminBrokersArchiveBtn: string;
    adminBrokersNameCol: string;
    adminBrokersPhoneCol: string;
    adminBrokersAgencyCol: string;
    adminBrokersRatingCol: string;
    adminBrokersActiveListingsCol: string;
    adminBrokersSpecCol: string;
    adminAgenciesTitle: string;
    adminAgenciesSearch: string;
    adminAgenciesNewBtn: string;
    adminAgenciesArchiveTitle: string;
    adminAgenciesArchiveMessage: string;
    adminAgenciesArchiveBtn: string;
    adminAgenciesNameCol: string;
    adminAgenciesEmailCol: string;
    adminAgenciesPhoneCol: string;
    adminAgenciesBrokersCol: string;
    adminAgenciesListingsCol: string;
    adminAgenciesRatingCol: string;
    adminPropertiesTitle: string;
    adminPropertiesSearch: string;
    adminPropertiesNewBtn: string;
    adminPropertiesDeleteTitle: string;
    adminPropertiesDeleteMessage: string;
    adminPropertiesDeleteBtn: string;
    adminPropertiesTitleCol: string;
    adminPropertiesNoTitle: string;
    adminPropertiesPriceCol: string;
    adminPropertiesTypeCol: string;
    adminPropertiesCategoryCol: string;
    adminPropertiesStateCol: string;
    adminPropertiesStateActive: string;
    adminPropertiesStateInactive: string;
    adminPropertiesBrokerCol: string;
    adminPropertiesDeactivate: string;
    adminPropertiesActivate: string;
    adminPropertiesHide: string;
    adminPropertiesShow: string;
    adminPropertiesUnfeature: string;
    adminPropertiesFeature: string;
    adminUsersTitle: string;
    adminUsersSearch: string;
    adminUsersNameCol: string;
    adminUsersNoName: string;
    adminUsersRoleCol: string;
    adminUsersPhoneCol: string;
    adminUsersCityCol: string;
    adminUsersRegisteredCol: string;
    adminUsersRoleUser: string;
    adminUsersRoleBroker: string;
    adminUsersRoleAdmin: string;
    adminUsersCreateAccountsTitle: string;
    adminUsersCreateAccountsDesc: string;
    adminUsersShowPreview: string;
    adminUsersCreateBtn: string;
    adminUsersAgencies: string;
    adminUsersBrokers: string;
    adminUsersTotal: string;
    adminUsersWithAccount: string;
    adminUsersToCreate: string;
    adminUsersResult: string;
    adminUsersCreatedAgencyAccounts: string;
    adminUsersCreatedBrokerAccounts: string;
    adminUsersSkippedDuplicate: string;
    adminUsersAgenciesNoEmail: string;
    adminUsersBrokersNoEmail: string;
    adminUsersErrors: string;
    adminUsersAndMore: string;
    adminUsersAllExist: string;
  };

  // ===== AUTH =====
  auth: {
    loginTitle: string;
    registerTitle: string;
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
    phone: string;
    loginButton: string;
    registerButton: string;
    forgotPassword: string;
    noAccount: string;
    hasAccount: string;
    orContinueWith: string;
    google: string;
    loginSuccess: string;
    loginError: string;
    registerSuccess: string;
    logoutSuccess: string;
    passwordMismatch: string;
    emailVerificationTitle: string;
    emailVerificationMessage: string;
    backToLogin: string;
    registerViaGoogle: string;
    enterEmail: string;
    resetPasswordSent: string;
  };

  // ===== OCENĚNÍ =====
  valuation: {
    title: string;
    subtitle: string;
    step1: string;
    step2: string;
    step3: string;
    addressLabel: string;
    addressPlaceholder: string;
    categoryLabel: string;
    subtypeLabel: string;
    areaLabel: string;
    conditionLabel: string;
    yearBuiltLabel: string;
    submit: string;
    resultTitle: string;
    estimatedPrice: string;
    priceEstimate: string;
    priceRange: string;
    disclaimer: string;
    // Wizard page
    stepOf: string;
    whatToValuate: string;
    whereIsProperty: string;
    cityLabel: string;
    selectCity: string;
    addressOptional: string;
    startTypingAddress: string;
    whatDisposition: string;
    whatArea: string;
    usableAreaApartment: string;
    usableAreaHouse: string;
    landArea: string;
    landAreaHouse: string;
    exampleArea: string;
    exampleLandArea: string;
    whatCondition: string;
    conditionNew: string;
    conditionRenovated: string;
    conditionVeryGood: string;
    conditionGood: string;
    conditionBeforeRenovation: string;
    conditionBad: string;
    whenBuilt: string;
    exampleYear: string;
    skipUnknown: string;
    whatFloor: string;
    howManyFloors: string;
    apartmentFloor: string;
    selectFloor: string;
    totalFloorsInBuilding: string;
    numberOfFloors: string;
    exampleFloors: string;
    whatFeatures: string;
    featureBalcony: string;
    featureTerrace: string;
    featureGarden: string;
    featureCellar: string;
    featureGarage: string;
    featureElevator: string;
    featureParking: string;
    featurePool: string;
    featureAC: string;
    featureLoggia: string;
    additionalInfo: string;
    landTypeLabel: string;
    landTypeBuilding: string;
    landTypeAgricultural: string;
    landTypeForest: string;
    landTypeOther: string;
    ownershipType: string;
    ownershipPersonal: string;
    ownershipCooperative: string;
    ownershipState: string;
    selectOption: string;
    energyLabel: string;
    energyNotSet: string;
    whereToSend: string;
    consentLabel: string;
    thankYouTitle: string;
    thankYouMessage: string;
    backToListings: string;
    back: string;
    continue: string;
    submitAndGetValuation: string;
    floorBasement: string;
    floorGround: string;
    floorN: string;
    floorAndAbove: string;
  };

  // ===== PRODEJ =====
  sell: {
    title: string;
    subtitle: string;
    lookingForBroker: string;
    step1Title: string;
    step2Title: string;
    step3Title: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    propertyAddress: string;
    propertyCategory: string;
    propertyArea: string;
    propertyDescription: string;
    submit: string;
    successTitle: string;
    successMessage: string;
    faq: {
      title: string;
      items: { question: string; answer: string }[];
    };
    // Sell page
    heroTitle: string;
    heroSubtitle: string;
    statBuyers: string;
    statBuyersLabel: string;
    statEstimate: string;
    statEstimateLabel: string;
    statFree: string;
    statFreeLabel: string;
    heroCta: string;
    valueCardLabel: string;
    valueCardSub: string;
    valueCardBtn: string;
    howItWorks: string;
    step1Sell: string;
    step1SellDesc: string;
    step2Sell: string;
    step2SellDesc: string;
    step3Sell: string;
    step3SellDesc: string;
    whySellTitle: string;
    benefit1Title: string;
    benefit1Desc: string;
    benefit2Title: string;
    benefit2Desc: string;
    benefit3Title: string;
    benefit3Desc: string;
    benefit4Title: string;
    benefit4Desc: string;
    formTitle: string;
    formSubtitle: string;
    checkEstimate: string;
    checkFree: string;
    checkRealData: string;
    checkNoObligation: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    phoneLabelShort: string;
    propertyTypeLabel: string;
    selectPlaceholder: string;
    intentLabel: string;
    intentSell: string;
    intentRent: string;
    intentEstimate: string;
    addressLabel: string;
    addressPlaceholder: string;
    noteLabel: string;
    notePlaceholder: string;
    sending: string;
    submitFree: string;
    formDisclaimer: string;
    successBackHome: string;
    typeApartment: string;
    typeHouse: string;
    typeLand: string;
    typeCommercial: string;
    typeOther: string;
  };

  // ===== ENUM LABELS =====
  enumLabels: {
    listingTypes: Record<string, string>;
    propertyCategories: Record<string, string>;
    apartmentSubtypes: Record<string, string>;
    houseSubtypes: Record<string, string>;
    landSubtypes: Record<string, string>;
    commercialSubtypes: Record<string, string>;
    otherSubtypes: Record<string, string>;
    propertyConditions: Record<string, string>;
    buildingMaterials: Record<string, string>;
    ownershipTypes: Record<string, string>;
    furnishingTypes: Record<string, string>;
    energyRatings: Record<string, string>;
    objectTypes: Record<string, string>;
    objectKinds: Record<string, string>;
    objectLocations: Record<string, string>;
    flatClasses: Record<string, string>;
    heatingTypes: Record<string, string>;
    parkingTypes: Record<string, string>;
    roomCounts: Record<string, string>;
    priceCurrencies: Record<string, string>;
    priceUnits: Record<string, string>;
    countries: Record<string, string>;
  };

  // ===== FOOTER =====
  footer: {
    about: string;
    aboutText: string;
    quickLinks: string;
    contact: string;
    contactEmail: string;
    contactPhone: string;
    terms: string;
    privacy: string;
    career: string;
    copyright: string;
    allRightsReserved: string;
  };

  // ===== PROFIL (broker/agency detail) =====
  profile: {
    statistics: string;
    activeListings: string;
    totalDeals: string;
    rating: string;
    reviews: string;
    noReviews: string;
    sinceYear: string;
    founded: string;
    brokersCount: string;
    dealsCount: string;
    listingsCount: string;
    branch: string;
    headquarters: string;
    branches: string;
  };

  // ===== AI HLEDÁNÍ =====
  aiSearch: {
    searchFailed: string;
    searchError: string;
  };

  // ===== SPECIALISTÉ =====
  specialists: {
    all: string;
    searchPlaceholder: string;
    location: string;
    specialization: string;
    brokers: string;
    agencies: string;
    clearFilters: string;
    foundOne: string;
    foundFew: string;
    foundMany: string;
    noResults: string;
    badgeBroker: string;
    badgeAgency: string;
    listingsLabel: string;
    ratingLabel: string;
    dealsLabel: string;
    brokersLabel: string;
  };

  // ===== DETAIL GRID (broker/agency properties) =====
  detailGrid: {
    listingTypeLabel: string;
    categoryLabel: string;
    priceLabel: string;
    areaLabel: string;
    priceUnit: string;
    from: string;
    to: string;
    clearFilters: string;
    noListings: string;
    noListingsFiltered: string;
    offerOne: string;
    offerFew: string;
    offerMany: string;
    pageInfo: string;
  };

  // ===== ADDRESS SEARCH (admin) =====
  addressSearch: {
    searchLabel: string;
    manualLabel: string;
    manualPlaceholder: string;
    landHint: string;
  };

  // ===== HEADER =====
  header: {
    userMenu: string;
    openMenu: string;
    closeMenu: string;
    gridViewLabel: string;
    listViewLabel: string;
    gridViewTitle: string;
    listViewTitle: string;
    defaultLocation: string;
    video: string;
    property: string;
    phone: string;
    detail: string;
    highInterest: string;
    foundedIn: string;
    branchOf: string;
    sinceYear: string;
  };

  // ===== HYPOTEČNÍ KALKULAČKA =====
  mortgage: {
    title: string;
    monthlyPayment: string;
    ownFunds: string;
    interestRate: string;
    repaymentPeriod: string;
    yearsLabel: string;
    loanAmount: string;
    totalPaid: string;
    ofWhichInterest: string;
  };

  // ===== SPOLEČNÉ =====
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    close: string;
    loading: string;
    error: string;
    success: string;
    confirm: string;
    yes: string;
    no: string;
    back: string;
    next: string;
    previous: string;
    search: string;
    noData: string;
    seeAll: string;
    showMore: string;
    showLess: string;
    addToFavorites: string;
    removeFromFavorites: string;
    copyLink: string;
    linkCopied: string;
    toggleTheme: string;
  };
}
