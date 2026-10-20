# Work Order: Blokada słownictwa MDR (MDR-VOCABULARY)

## Metadane
- **Wymagania:** `MDR-VOCABULARY`
- **Domena:** presentation
- **Ryzyko:** MEDIUM

## Cele
1. Zdefiniować skrypt walidujący kod źródłowy (np. test wywoływany przez Vitest), który skanuje pliki z katalogów ewentualnego frontendu/widoków, aby zablokować słowo "pacjent" i jego odmiany. Zgodnie z wymaganiem identyfikatory bazy (patients) są usunięte, ale skrypt zabezpieczy warstwę wizualną przed powrotem słowa.
2. Napisać test jednostkowy `mdr_vocabulary.test.ts`.
