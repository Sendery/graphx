// Datos de ejemplo: un radar de PRs ficticio para una empresa inventada.
// Nada aquí corresponde a personas, repositorios ni tickets reales.

const ME = "ana-rivera";
const GROUPS = [
  {id:"nav", name:"Warehouses en Organización", sub:"navegación y textos"},
  {id:"members", name:"Pestaña de personas", sub:"Staff"},
  {id:"detail", name:"Página de detalle", sub:"warehouse detail"},
  {id:"list", name:"Lista y demo", sub:"Data Collection"},
  {id:"geo", name:"Normalización geográfica", sub:"city / state → id"},
  {id:"form", name:"Alta, edición y direcciones", sub:"LocationInput"},
  {id:"mapview", name:"Vista de mapa", sub:"monorepo + ui-kit"},
  {id:"mapkit", name:"MapView en ui-kit", sub:"motor y proveedores"},
  {id:"core", name:"Core backend y eventos", sub:"locations"},
  {id:"other", name:"Transversales", sub:"fuera del proyecto"},
];

// s: merged | pending | draft | changes ; d = merge date (merged) or open date
const PRS = [
  // nav
  {id:"1000",r:"platform",g:"nav",s:"merged",d:"07-28",t:"add the warehouses tab behind a flag",a:"bruno-soler"},
  {id:"1001",r:"platform",g:"nav",s:"merged",d:"09-18",t:"relocate tab links to the mounted base",a:"clara-mendez",tk:[["WH-100"]],deps:[["1000", "func"]]},
  {id:"1002",r:"platform",g:"nav",s:"merged",d:"09-21",t:"'Warehouses has moved' notice",a:"clara-mendez",tk:[["WH-101"]],deps:[["1001", "func"]]},
  {id:"1003",r:"platform",g:"nav",s:"changes",d:"09-21",t:"keep the old route redirecting",a:"clara-mendez",tk:[["WH-102", "WH-103"], ["WH-104", "WH-105"]],note:"2 aprobaciones, pero fcsonline pidió cambios el 24-sep: hablar con el equipo de traducciones para reutilizar las actuales"},
  {id:"1004",r:"platform",g:"nav",s:"pending",d:"09-22",t:"drop the legacy entry from the sidebar",a:"clara-mendez",tk:[["WH-106", "WH-103"], ["WH-102", "WH-103"]],deps:[["1003", "stack"], ["1001", "func"]]},
  {id:"1005",r:"platform",g:"nav",s:"draft",d:"09-22",t:"tidy the breadcrumb for nested views",a:"bruno-soler",tk:[["WH-107", "WH-108"]],deps:[["1000", "func"]],note:"Título nuevo hoy (antes: QA fixes for warehouses in Organization)"},
  // members
  {id:"1006",r:"platform",g:"members",s:"merged",d:"09-22",t:"list the staff assigned to a warehouse",a:"diego-narvaez",tk:[["WH-109"]]},
  {id:"1007",r:"platform",g:"members",s:"pending",d:"09-23",t:"paginate the staff tab",a:"diego-narvaez",tk:[["WH-110", "WH-108"], ["WH-111", "WH-112"]],deps:[["1003", "func"], ["1006", "func"]],note:"Usa el namespace de i18n que crea la #1003"},
  {id:"1008",r:"platform",g:"members",s:"draft",d:"09-23",t:"empty state for a warehouse with no staff",a:"diego-narvaez",tk:[["WH-110", "WH-108"]],deps:[["1007", "stack"]]},
  {id:"1009",r:"platform",g:"members",s:"pending",d:"09-10",t:"filter staff by role",a:"diego-narvaez",tk:[["WH-109", "WH-108"]],deps:[["1006", "func"]],note:"Última del conjunto WH-109; la ha detectado el monitor"},
  // detail
  {id:"1010",r:"platform",g:"detail",s:"merged",d:"08-28",t:"detail page skeleton",a:"clara-mendez",tk:[["WH-113"]]},
  {id:"1011",r:"platform",g:"detail",s:"merged",d:"09-01",t:"show opening hours on the header",a:"clara-mendez",tk:[["WH-114"]]},
  {id:"1012",r:"platform",g:"detail",s:"merged",d:"09-17",t:"edit button respects permissions",a:"bruno-soler",note:"mergeada en la rama de #1013"},
  {id:"1013",r:"platform",g:"detail",s:"pending",d:"09-07",t:"surface the address block",a:"bruno-soler",tk:[["WH-115", "WH-112"]],deps:[["1014", "stack"], ["1012", "stack"], ["1010", "func"], ["1011", "func"]]},
  // list
  {id:"1015",r:"platform",g:"list",s:"merged",d:"08-07",t:"card grid for the warehouse list",a:"bruno-soler"},
  {id:"1016",r:"platform",g:"list",s:"draft",d:"09-03",t:"sort by city and by capacity",a:"clara-mendez",tk:[["WH-116", "WH-112"]],note:"independiente"},
  // geo
  {id:"1017",r:"platform",g:"geo",s:"pending",d:"09-17",t:"normalise city and state to ids",a:"ana-rivera",tk:[["WH-117", "WH-108"]]},
  {id:"1018",r:"platform",g:"geo",s:"draft",d:"09-22",t:"backfill the existing rows",a:"ana-rivera",tk:[["WH-118", "WH-108"], ["WH-119", "WH-108"]],deps:[["1017", "func"]]},
  {id:"1019",r:"platform",g:"geo",s:"draft",d:"09-23",t:"fall back to the raw string when the id is unknown",a:"ana-rivera",tk:[["WH-119", "WH-108"]],deps:[["1018", "stack"]]},
  {id:"1020",r:"platform",g:"geo",s:"draft",d:"09-23",t:"cache geocoding lookups",a:"ana-rivera",tk:[["WH-119", "WH-108"]],deps:[["1019", "stack"]]},
  {id:"1021",r:"platform",g:"geo",s:"draft",d:"09-24",t:"reject coordinates outside the country",a:"ana-rivera",tk:[["WH-119", "WH-108"]],deps:[["1020", "stack"]],note:"Detectada por el monitor"},
  // form
  {id:"1022",r:"ui-kit",g:"form",s:"merged",d:"09-17",t:"address autocomplete in the create form",a:"bruno-soler"},
  {id:"1023",r:"platform",g:"form",s:"merged",d:"09-17",t:"validate postal codes per country",a:"elena-ortiz"},
  {id:"1014",r:"platform",g:"form",s:"pending",d:"09-07",t:"edit keeps the pristine address untouched",a:"bruno-soler",tk:[["WH-120", "WH-112"]],deps:[["1022", "func"], ["1023", "func"]],note:"Rama reescrita hoy (9 commits)"},
  // mapview
  {id:"1024",r:"ui-kit",g:"mapview",s:"merged",d:"09-10",t:"embed the map on the list page",a:"bruno-soler"},
  {id:"1025",r:"ui-kit",g:"mapview",s:"changes",d:"09-03",t:"cluster pins above fifty markers",a:"clara-mendez",tk:[["WH-121", "WH-112"]],deps:[["1024", "stack"], ["1026", "func"]],note:"Aprobada hoy por bruno-soler; siguen los cambios pedidos"},
  {id:"1027",r:"platform",g:"mapview",s:"draft",d:"09-03",t:"sync the map viewport with the filters",a:"clara-mendez",tk:[["WH-121", "WH-112"]],deps:[["1025", "stack"], ["1015", "func"]]},
  {id:"1028",r:"platform",g:"mapview",s:"draft",d:"09-03",t:"pin tooltip shows the address",a:"clara-mendez",tk:[["WH-121", "WH-112"], ["WH-115", "WH-112"]],deps:[["1027", "stack"]]},
  {id:"1029",r:"platform",g:"mapview",s:"draft",d:"09-08",t:"lazy-load the map bundle",a:"diego-narvaez",tk:[["WH-122", "WH-103"], ["WH-123", "WH-112"]],deps:[["1030", "func"], ["1027", "func"]],note:"Desbloqueada: ui-kit#1030 mergeada, falta subir ui-kit-react"},
  {id:"1031",r:"platform",g:"mapview",s:"draft",d:"09-23",t:"embed the map on the list page (follow-up 2)",a:"diego-narvaez",tk:[["WH-124", "WH-112"]],deps:[["1025", "stack"]],note:"Camino paralelo a #1027"},
  // mapkit
  {id:"1026",r:"ui-kit",g:"mapkit",s:"merged",d:"08-13",t:"provider fallback when the tiles fail",a:"bruno-soler"},
  {id:"1032",r:"ui-kit",g:"mapkit",s:"merged",d:"09-09",t:"theme the map from design tokens",a:"diego-narvaez",deps:[["1026", "func"]]},
  {id:"1033",r:"ui-kit",g:"mapkit",s:"merged",d:"09-14",t:"expose a controlled viewport prop",a:"diego-narvaez",deps:[["1032", "func"]]},
  {id:"1034",r:"ui-kit",g:"mapkit",s:"merged",d:"09-14",t:"marker slot accepts custom content",a:"diego-narvaez",deps:[["1033", "func"]]},
  {id:"1035",r:"ui-kit",g:"mapkit",s:"merged",d:"09-15",t:"document the provider contract",a:"diego-narvaez",deps:[["1034", "func"]]},
  {id:"1036",r:"ui-kit",g:"mapkit",s:"merged",d:"09-17",t:"provider fallback when the tiles fail (follow-up 2)",a:"diego-narvaez",deps:[["1035", "func"]]},
  {id:"1037",r:"ui-kit",g:"mapkit",s:"merged",d:"09-18",t:"theme the map from design tokens (follow-up 2)",a:"diego-narvaez",deps:[["1036", "func"]]},
  {id:"1038",r:"ui-kit",g:"mapkit",s:"merged",d:"09-21",t:"expose a controlled viewport prop (follow-up 2)",a:"diego-narvaez",deps:[["1037", "func"]]},
  {id:"1039",r:"ui-kit",g:"mapkit",s:"merged",d:"09-21",t:"marker slot accepts custom content (follow-up 2)",a:"diego-narvaez",tk:[["WH-125"]],note:"entró con #1030"},
  {id:"1030",r:"ui-kit",g:"mapkit",s:"merged",d:"09-23",t:"document the provider contract (follow-up 2)",a:"diego-narvaez",tk:[["WH-122", "WH-103"], ["WH-125", "WH-126"]],deps:[["1038", "func"], ["1039", "stack"]],note:"Mergeada hoy"},
  {id:"1040",r:"ui-kit",g:"mapkit",s:"draft",d:"09-08",t:"provider fallback when the tiles fail (follow-up 3)",a:"diego-narvaez",tk:[["WH-127", "WH-126"], ["WH-123", "WH-112"]],deps:[["1026", "func"]]},
  // core
  {id:"1041",r:"platform",g:"core",s:"merged",d:"07-24",t:"locations table and its model",a:"farid-haddad",tk:[["WH-128"]]},
  {id:"1042",r:"platform",g:"core",s:"merged",d:"07-27",t:"publish an event when a location changes",a:"farid-haddad",tk:[["WH-129"]]},
  {id:"1043",r:"platform",g:"core",s:"merged",d:"07-28",t:"soft delete keeps the history",a:"gemma-roca"},
  {id:"1044",r:"platform",g:"core",s:"pending",d:"09-10",t:"index the lookup columns",a:"hugo-prats",tk:[["WH-130", "WH-103"]],deps:[["1043", "func"]]},
  // other
  {id:"1045",r:"ui-kit",g:"other",s:"merged",d:"08-24",t:"bump the shared linter",a:"clara-mendez"},
  {id:"1046",r:"ui-kit",g:"other",s:"merged",d:"08-24",t:"flaky test in the scheduler suite",a:"clara-mendez"},
  {id:"1047",r:"ui-kit",g:"other",s:"draft",d:"08-24",t:"typo in the release checklist",a:"clara-mendez",tk:[["WH-131", "WH-126"]],deps:[["1045", "stack"], ["1046", "stack"]]},
  {id:"1048",r:"ui-kit",g:"other",s:"pending",d:"08-26",t:"unrelated dependency bump",a:"diego-narvaez",tk:[["WH-132", "WH-126"]]},
  {id:"1049",r:"ui-kit",g:"other",s:"draft",d:"08-27",t:"bump the shared linter (follow-up 2)",a:"ines-valls"},
  {id:"1050",r:"platform",g:"other",s:"pending",d:"09-03",t:"flaky test in the scheduler suite (follow-up 2)",a:"bruno-soler"},
];

const RELATED = [
  ["Nota de diseño 1","060277ac3fe1f4b2d61480"],
  ["Nota de diseño 2","eb41c94bfdb75276ae465e"],
  ["Nota de diseño 3","04e0a109d46cd75bfb56cc"],
  ["Nota de diseño 4","8e5b20d82a3b90307ee43f"],
  ["Nota de diseño 5","bd10336b55a5b752cb2e35"],
  ["Nota de diseño 6","3d0706d6bd642cb58d7c92"],
  ["Nota de diseño 7","a91b0d186e34ffd774c6dc"],
  ["Nota de diseño 8","468560553f61aa1e6e935b"],
  ["Nota de diseño 9","884e74b6b1fc5ad8ab27d2"],
  ["Nota de diseño 10","75dfa4d7c0dfaa7ba6d774"],
];

const EPICS = [
  {id:"WH-900", name:"Warehouses: Page", status:"To Do", who:"Ana Rivera"},
  {id:"WH-901", name:"Warehouses: Migration & validation", status:"In Progress", who:"Bruno Soler"},
  {id:"WH-902", name:"Warehouses: Core", status:"To Do", who:"Bruno Soler"},
  {id:"WH-903", name:"Warehouses: Map", status:"To Do", who:"Ana Rivera"},
  {id:"WH-904", name:"Warehouses: Rollout", status:"To Do", who:"Ana Rivera"},
  {id:"WH-905", name:"Warehouses: Docs", status:"In Progress", who:"Clara Méndez"},
  {id:"WH-906", name:"Warehouses: Cleanup", status:"", who:"Diego Narváez"},
];

const TICKETS = {
  "WH-102":{e:"WH-900",s:"In Code Review",t:"add the warehouses tab behind a flag (follow-up 2)",w:"Elena Ortiz"},
  "WH-104":{e:"WH-900",s:"Blocked",t:"avatars fall back to initials",w:"Elena Ortiz",warn:"Blocked; la #1003 que lo cita tiene cambios pedidos"},
  "WH-106":{e:"WH-900",s:"In Code Review",t:"tabs keep their scroll position",w:"Elena Ortiz"},
  "WH-115":{e:"WH-900",s:"To Do",t:"search box debounces its query",w:"Clara Méndez",warn:"To Do y sin asignar con PR abierta"},
  "WH-110":{e:"WH-900",s:"In Progress",t:"normalise city and state to ids (follow-up 2)",w:"Ana Rivera"},
  "WH-111":{e:"WH-900",s:"To Do",t:"inline errors on the address block",w:"Clara Méndez",warn:"To Do, pero la #1007 ya implementa su recomendación"},
  "WH-100":{e:"WH-900",s:"Done",t:"cluster pins above fifty markers (follow-up 2)",w:"Elena Ortiz"},
  "WH-101":{e:"WH-900",s:"Done",t:"theme the map from design tokens (follow-up 3)",w:"Elena Ortiz"},
  "WH-113":{e:"WH-900",s:"Done",t:"expose locations through the public API",w:"Elena Ortiz"},
  "WH-114":{e:"WH-900",s:"Done",t:"typo in the release checklist (follow-up 2)",w:"Elena Ortiz"},
  "WH-117":{e:"WH-901",s:"In Progress",t:"relocate tab links to the mounted base (follow-up 2)",w:"Bruno Soler"},
  "WH-118":{e:"WH-901",s:"In Progress",t:"list the staff assigned to a warehouse (follow-up 2)",w:"Bruno Soler"},
  "WH-119":{e:"WH-901",s:"In Progress",t:"detail page skeleton (follow-up 2)",w:"Bruno Soler"},
  "WH-120":{e:"WH-901",s:"To Do",t:"demo seed for the empty account",w:"Clara Méndez",warn:"To Do y sin asignar con PR abierta"},
  "WH-116":{e:"WH-902",s:"To Do",t:"backfill the existing rows (follow-up 2)",w:"Clara Méndez",warn:"To Do y sin asignar con PR abierta"},
  "WH-121":{e:"WH-903",s:"To Do",t:"confirm before discarding a draft",w:"Clara Méndez",warn:"To Do y sin asignar; 3 PRs lo tocan"},
  "WH-122":{e:"WH-904",s:"In Code Review",t:"sync the map viewport with the filters (follow-up 2)",w:"Ana Rivera",warn:"In Code Review, pero ui-kit#1030 se mergeó hoy"},
  "WH-125":{e:"WH-904",s:"Done",t:"expose a controlled viewport prop (follow-up 3)",w:"Ana Rivera"},
  "WH-127":{e:"WH-904",s:"Done",t:"locations table and its model (follow-up 2)",w:"Ana Rivera",warn:"Done con ui-kit#1040 aún abierta"},
  "WH-130":{e:"WH-905",s:"In Code Review",t:"unrelated dependency bump (follow-up 2)",w:"Farid Haddad"},
  "WH-107":{e:"WH-906",s:"In Progress",t:"'Warehouses has moved' notice (follow-up 2)",w:"Elena Ortiz"},
  "WH-109":{e:"WH-906",s:"In Progress",t:"paginate the staff tab (follow-up 2)",w:"Ana Rivera"},
  "WH-132":{e:"WH-906",s:"Done",t:"show opening hours on the header (follow-up 2)",w:"Ana Rivera",warn:"Done con ui-kit#1048 aún abierta"},
  "WH-131":{e:"WH-906",s:"Done",t:"virtualise long lists",w:"Elena Ortiz"},
  "WH-129":{e:"WH-906",s:"Done",t:"fall back to the raw string when the id is unknown (follow-up 2)",w:"Gemma Roca"},
  "WH-128":{e:"WH-906",s:"Done",t:"address autocomplete in the create form (follow-up 2)",w:"Gemma Roca"},
};

