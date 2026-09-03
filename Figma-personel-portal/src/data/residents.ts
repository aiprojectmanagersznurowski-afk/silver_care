export type ReportStatus = "brak_wpisu" | "robocza" | "gotowy";

export interface StaffResident {
  id: string;
  name: string;
  firstName: string;
  room: string;
  bed: string;
  floor: number;
  status: ReportStatus;
  initials: string;
  avatarColor: string;
  age: number;
  draftText?: string;
}

export const staffResidents: StaffResident[] = [
  {
    id: "1", name: "Zofia Kowalska", firstName: "Zofia",
    room: "101", bed: "A", floor: 1, status: "gotowy",
    initials: "ZK", avatarColor: "#FF9F47", age: 82,
    draftText: "Pensjonariuszka w bardzo dobrym nastroju. Uczestniczyła w zajęciach plastycznych, zjadła cały obiad. Ciśnienie krwi w normie. Spacer w ogrodzie przez 25 minut bez trudności. Wieczorem oglądała telewizję i rozmawiała z innymi mieszkańcami.",
  },
  {
    id: "2", name: "Henryk Nowak", firstName: "Henryk",
    room: "102", bed: "B", floor: 1, status: "robocza",
    initials: "HN", avatarColor: "#5AC8FA", age: 78,
    draftText: "Senior w dobrej kondycji ogólnej. Ukończył sesję fizjoterapii. Po południu grał w szachy. Apetyt dobry, leki podane zgodnie z planem. Wymaga obserwacji w zakresie...",
  },
  {
    id: "3", name: "Maria Wiśniewska", firstName: "Maria",
    room: "103", bed: "A", floor: 1, status: "brak_wpisu",
    initials: "MW", avatarColor: "#30D158", age: 90,
  },
  {
    id: "4", name: "Jan Kowalczyk", firstName: "Jan",
    room: "104", bed: "A", floor: 1, status: "gotowy",
    initials: "JK", avatarColor: "#AF52DE", age: 75,
    draftText: "Pan Jan spędził aktywny dzień. Uczestniczył w grupowych zajęciach muzycznych. Zjadł wszystkie posiłki. Nastrój pogodny, komunikatywny z personelem i innymi pensjonariuszami.",
  },
  {
    id: "5", name: "Teresa Jabłońska", firstName: "Teresa",
    room: "105", bed: "B", floor: 1, status: "brak_wpisu",
    initials: "TJ", avatarColor: "#FF6B47", age: 88,
  },
  {
    id: "6", name: "Wanda Wojciechowska", firstName: "Wanda",
    room: "106", bed: "A", floor: 1, status: "gotowy",
    initials: "WW", avatarColor: "#FF6B9A", age: 84,
    draftText: "Pensjonariuszka aktywna i w dobrym nastroju. Poranna gimnastyka z grupą. Zjadła śniadanie i obiad. Popołudniowa drzemka. Leki podane o właściwych porach.",
  },
  {
    id: "7", name: "Bronisław Szymański", firstName: "Bronisław",
    room: "107", bed: "B", floor: 1, status: "brak_wpisu",
    initials: "BS", avatarColor: "#64D2FF", age: 71,
  },
  {
    id: "8", name: "Stanisław Piotrowski", firstName: "Stanisław",
    room: "201", bed: "A", floor: 2, status: "robocza",
    initials: "SP", avatarColor: "#007AFF", age: 79,
    draftText: "Senior w stabilnym stanie. Rano miał wizytę u lekarza ogólnego. Wyniki badań kontrolnych w trakcie oceny. Po południu odpoczywał.",
  },
  {
    id: "9", name: "Irena Zielińska", firstName: "Irena",
    room: "202", bed: "B", floor: 2, status: "gotowy",
    initials: "IZ", avatarColor: "#FF9500", age: 86,
    draftText: "Pani Irena świetnie się czuje. Wzięła udział w zajęciach ogrodniczych i bardzo się w nich angażowała. Apetyt doskonały. Nastrój pogodny i radosny.",
  },
  {
    id: "10", name: "Władysław Dąbrowski", firstName: "Władysław",
    room: "203", bed: "A", floor: 2, status: "brak_wpisu",
    initials: "WD", avatarColor: "#34C759", age: 80,
  },
  {
    id: "11", name: "Genowefa Kamińska", firstName: "Genowefa",
    room: "204", bed: "B", floor: 2, status: "brak_wpisu",
    initials: "GK", avatarColor: "#BF5AF2", age: 91,
  },
  {
    id: "12", name: "Kazimierz Lewandowski", firstName: "Kazimierz",
    room: "205", bed: "A", floor: 2, status: "robocza",
    initials: "KL", avatarColor: "#5856D6", age: 76,
    draftText: "Pan Kazimierz uczestniczył w porannej rehabilitacji. Ćwiczenia przebiegały pomyślnie. Wymaga dalszej obserwacji w zakresie mobilności.",
  },
];

export const statusConfig: Record<ReportStatus, { label: string; bg: string; text: string; dot: string }> = {
  brak_wpisu: { label: "Brak wpisu", bg: "rgba(255,59,48,0.1)", text: "#C0392B", dot: "#FF3B30" },
  robocza: { label: "Wersja robocza", bg: "rgba(255,149,0,0.12)", text: "#9A5E00", dot: "#FF9500" },
  gotowy: { label: "Raport gotowy", bg: "rgba(52,199,89,0.1)", text: "#248A3D", dot: "#34C759" },
};
