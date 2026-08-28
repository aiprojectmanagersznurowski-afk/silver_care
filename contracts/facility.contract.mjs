/**
 * facility.contract.mjs — rejestr pokoi i łóżek placówki.
 *
 * ADR-012, rozstrzygnięte 2026-08-27. Schemat produkcyjny miał trzy luźne pola
 * tekstowe na rekordzie pensjonariusza: room, sector, floor. Wystarczały do
 * wyświetlenia informacji, ale nie dawały: kontroli nad literówką w numeracji,
 * policzenia wolnych łóżek ani zablokowania podwójnego przypisania.
 *
 * Decyzja: pokoje i łóżka są osobnym rejestrem zarządzanym przez administratora,
 * z twardą regułą — jedno łóżko, jeden aktywny pensjonariusz jednocześnie.
 */

/** Struktura fizyczna placówki, od największej jednostki do najmniejszej. */
export const FACILITY_HIERARCHY = ['organization', 'floor', 'room', 'bed'];

/**
 * Pokój. Piętro i sektor zostają na pokoju, nie na łóżku — łóżka w jednym
 * pokoju są zawsze na tym samym piętrze, duplikowanie tej informacji na
 * każdym łóżku otwierałoby drzwi do rozjazdu (łóżko A piętro 2, łóżko B tego
 * samego pokoju piętro 3 przez pomyłkę przy edycji).
 */
export const ROOM_SHAPE = {
  table: 'rooms',
  fields: [
    { name: 'id', type: 'uuid', desc: 'Klucz główny.' },
    { name: 'organization_id', type: 'uuid', desc: 'Izolacja placówki — jak wszystko inne w systemie.' },
    { name: 'number', type: 'text', desc: 'Numer albo nazwa pokoju, np. „204" albo „Słoneczny". Unikalny w obrębie placówki.' },
    { name: 'floor', type: 'text', desc: 'Piętro. Wartość opisowa, nie liczba — dopuszcza „Parter".' },
    { name: 'sector', type: 'text', desc: 'Sektor/skrzydło placówki. Nullable — nie każda placówka ma podział na sektory.' },
    { name: 'bed_count', type: 'int', desc: 'Pole pochodne: liczba łóżek przypisanych do pokoju. Nie edytowane ręcznie.' },
    { name: 'is_active', type: 'boolean', desc: 'Pokój wyłączony z użytku (remont) nie znika z historii, ale nie przyjmuje nowych przypisań.' },
  ],
  uniqueness: 'Para (organization_id, number) unikalna — dwa pokoje o tym samym numerze w jednej placówce to błąd wprowadzania danych, nie różne pokoje.',
};

/**
 * Łóżko. Numeracja w obrębie pokoju, nie globalna — „łóżko 1" znaczy co innego
 * w każdym pokoju, tak jak w rzeczywistości.
 */
export const BED_SHAPE = {
  table: 'beds',
  fields: [
    { name: 'id', type: 'uuid', desc: 'Klucz główny.' },
    { name: 'room_id', type: 'uuid', desc: 'FK do rooms.' },
    { name: 'label', type: 'text', desc: 'Etykieta w obrębie pokoju: „1", „A", „przy oknie". Unikalna w obrębie pokoju, nie globalnie.' },
    { name: 'is_active', type: 'boolean', desc: 'Łóżko wyłączone z użytku bez usuwania historii przypisań.' },
  ],
  uniqueness: 'Para (room_id, label) unikalna.',
};

/**
 * Przypisanie pensjonariusza do łóżka. Osobna tabela z historią, nie kolumna
 * bed_id na residents — bo trzeba wiedzieć, kto leżał gdzie i kiedy, nie tylko
 * kto leży teraz. Bez historii przeniesienie między pokojami kasowałoby ślad
 * potrzebny choćby przy dochodzeniu w sprawie zdarzenia w konkretnym pokoju.
 */
export const BED_ASSIGNMENT_SHAPE = {
  table: 'bed_assignments',
  fields: [
    { name: 'id', type: 'uuid', desc: 'Klucz główny.' },
    { name: 'bed_id', type: 'uuid', desc: 'FK do beds.' },
    { name: 'resident_id', type: 'uuid', desc: 'FK do residents.' },
    { name: 'assigned_at', type: 'timestamp', desc: 'Początek przypisania.' },
    { name: 'unassigned_at', type: 'timestamp', desc: 'Nullable. NULL oznacza przypisanie wciąż aktywne.' },
    { name: 'assigned_by', type: 'uuid', desc: 'Kto wykonał przypisanie — do audytu.' },
    { name: 'reason', type: 'text', desc: 'Powód zmiany: przyjęcie, przeniesienie, wypis. Nullable dla pierwszego przypisania.' },
  ],
  invariant: 'W danym momencie co najwyżej jedno przypisanie z unassigned_at = NULL na dane bed_id, i co najwyżej jedno na dane resident_id. Jedno łóżko, jeden aktywny pensjonariusz. Jeden pensjonariusz, jedno aktywne łóżko.',
};

/**
 * Guardy operacji, egzekwowane przez bazę (constraint albo trigger), nie
 * wyłącznie przez logikę aplikacji — RLS i tak jest ostatnią linią obrony
 * w tym systemie, ta reguła nie powinna być wyjątkiem.
 */
export const OCCUPANCY_GUARDS = [
  { id: 'bed_single_occupant', desc: 'Przypisanie do łóżka z aktywnym przypisaniem innej osoby jest odrzucane, nie nadpisywane.', onViolation: 'REJECT' },
  { id: 'resident_single_bed', desc: 'Pensjonariusz z aktywnym przypisaniem nie może dostać drugiego bez zamknięcia pierwszego. Przeniesienie jest jedną operacją zamykającą stare i otwierającą nowe, nie dwiema osobnymi.', onViolation: 'REJECT' },
  { id: 'inactive_bed_no_assign', desc: 'Łóżko oznaczone jako nieaktywne nie przyjmuje nowych przypisań.', onViolation: 'REJECT' },
  { id: 'archived_resident_no_assign', desc: 'Zarchiwizowany pensjonariusz nie może dostać przypisania.', onViolation: 'REJECT' },
];

/** Widok obłożenia, pochodny — nie osobno utrzymywana liczba, żeby nie rozjeżdżał się z rzeczywistymi przypisaniami. */
export const OCCUPANCY_VIEW = {
  name: 'room_occupancy',
  computedFrom: 'bed_assignments WHERE unassigned_at IS NULL, zgrupowane po room_id',
  fields: ['room_id', 'bed_count', 'occupied_count', 'free_count'],
  desc: 'Administrator widzi obłożenie bez ręcznego liczenia. Zawsze zgodne z bed_assignments, bo jest z niego wyliczane, nie kopiowane.',
};
