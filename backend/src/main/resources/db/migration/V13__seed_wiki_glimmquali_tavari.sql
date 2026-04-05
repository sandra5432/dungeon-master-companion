-- V13__seed_wiki_glimmquali_tavari.sql
-- Seed wiki entries for Glimmquali (SPEZIES) and Tavari (TERM) in the Pardur world.

INSERT INTO wiki_entries (title, type, world_id, body, created_by_user_id, created_at, updated_at)
VALUES (
  'Glimmquali',
  'SPEZIES',
  (SELECT id FROM worlds WHERE name = 'Pardur' LIMIT 1),
  '> *„Wie funkelnde Tropfen im endlosen Meer ziehen die Glimmquali durch die Strömungen von Pardur – friedlich, neugierig und stets mit vielen Tavari im Gepäck, als süßes Versprechen, dass selbst die längste Reise mit Freundschaft und Wärme erfüllt sein kann."*

## Aussehen

Die Glimmquali ähneln **rosa, axolotl-artigen Humanoiden** mit weicher Haut, großen Augen und auffälligen Kiemen. Ihr Körperbau ist klein und an das Leben im Wasser angepasst. Sie können sowohl über als auch unter Wasser atmen und in beiden Elementen mühelos existieren. Im Wasser bewegen sie sich elegant und schnell, an Land wirken sie eher gemächlich. Ihre Kleidung ist schlicht und funktional, meist aus wasserfesten Stoffen gefertigt.

## Charakter

- Friedlich und diplomatisch im Umgang mit anderen
- Vermeiden Konflikte, wo immer möglich
- Setzen auf Austausch und Handel
- Neugierig und offen – geschätzte Gesprächspartner
- Gesellig und in Gruppen stark verbunden
- Pragmatisch und geschickte Händler, die den Wert von Waren genau einschätzen

## Kultur

- Bekannt für ihre typische Speise **Tavari**: ein mochi-förmiges Gebäck mit festen Teighüllen und meist vegetarischen Füllungen; dient als Wegzehrung und Symbol der Gastfreundschaft
- Pflegen Musik und Erzählungen (Themen: Meer, Reisen, ihr Wassergott)
- Ausgeprägte Handelskunst; wichtige Vermittler zwischen verstreuten Siedlungen Pardurs
- Reisend und nomadisch lebend

## Nachwuchs (Quappen)

- Werden ohne vordefiniertes Geschlecht geboren, das sich erst im weiteren Verlauf entwickelt
- Wachsen sehr langsam und werden von den Eltern liebevoll umsorgt
- In frühen Stadien werden sie in **Nährstoffblasen** großgezogen, die von speziellen Pflanzen in Seegrasfeldern abgegeben werden
- Die Pflanzen lassen sich nicht kultivieren → die Glimmquali sammeln auf Reisen Nährstoffblasen aus natürlichen Reservoirs
- Aufgrund ihrer Seltenheit sind Nährstoffblasen bei den Glimmquali als Handelsware sehr gefragt

## Berufe & Ränge (bekannte)

- **Tiefenrufer** (Magier)
- **Wellensänger** (Barde)
- Krieger (für den Schutz der Gruppe vor Meeresgefahren)

## Ansiedlungen

Feste Ansiedlungen sind selten und meist klein. Die Glimmquali leben überwiegend nomadisch in Handelsfamilien. Ihre eigentliche Heimat ist die **Reise selbst**.

## Glaube

- Verehren einen **Wassergott**, den sie als Quelle allen Lebens und Hüter der Strömungen betrachten
- Rituale: Tavari oder Muscheln dem Meer übergeben (Dankbarkeit / Schutz erbitten)
- Wasser gilt als reinigend und verbindend

## Namen (geschlechtsneutral)

| Kurzname | Langname | Bedeutung |
|---|---|---|
| Lumuu | Lumaquarieluun | „das Licht, das durch Wasser singt" |
| Zali | Zalitharionae | „die Welle, die den Mond trägt" |
| Miroo | Mirondeluvioo | „der Wanderer zwischen Strömungen" |
| Tivvi | Tivvarielithae | „die Sprudelnde, die Freude bringt" |
| Nolaa | Nolarithuunaa | „die Pflanze, die im Licht wurzelt" |
| Eshoo | Eshoorivanelae | „die Stimme des Wassernebels" |
| Vanuu | Vanurelithuun | „der Tiefenrufer im stillen Strom" |
| Kalii | Kaliorenthiaa | „die Tänzerin der Lichtblasen" |
| Riluu | Rilumetharuu | „der Sammler der Geschichten" |
| Samoa | Samorielithaa | „die Reisende der fernen Strömungen" |
| Yelii | Yelitharionae | „die Neugier des Morgenlichts" |
| Omuu | Omurelithuunaa | „der Flüsterer der Pflanzen" |
| Zeloo | Zelorinthiaa | „der Blasenmagier des Stroms" |
| Thalii | Thaliorenethuun | „der alte Weise des Wassers" |
| Benuu | Benurelithaar | „der Reisende mit Naturbindung" |

## Geschichte

Die Ursprünge der Glimmquali liegen in den Ozeanen Pardurs, wo sie sich aus amphibischen Vorfahren entwickelten. Mit der Zeit wurden sie zu einem reisenden Händlervolk, das den Austausch zwischen Inseln und schwimmenden Märkten förderte. Ihre Geschichte ist geprägt von friedlichem Handel und diplomatischem Geschick.',
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO wiki_entries (title, type, world_id, body, created_by_user_id, created_at, updated_at)
VALUES (
  'Tavari',
  'TERM',
  (SELECT id FROM worlds WHERE name = 'Pardur' LIMIT 1),
  '## Beschreibung

Tavari sind **mochi-förmige Gebäckstücke** mit festen Teighüllen und meist vegetarischen Füllungen. Sie sind das bekannteste Kulturgut der Glimmquali und weit über deren Handelswege hinaus bekannt.

## Bedeutung

- Dienen als **Wegzehrung** auf langen Reisen
- Gelten als Symbol der **Gastfreundschaft** – einem Fremden Tavari anzubieten ist ein Zeichen des Friedens und des Vertrauens
- Werden bei Handelstreffen und Begegnungen geteilt

## Herstellung

Die genaue Rezeptur variiert je nach Region und Saison. Die Füllung ist traditionell vegetarisch, passend zur friedlichen und naturverbundenen Lebensweise der Glimmquali. Der Teig wird aus Meerespflanzen gewonnen und an der Luft getrocknet, bevor er geformt wird.

## Verbreitung

Da die Glimmquali als nomadisches Händlervolk weite Teile Pardurs bereisen, haben sich Tavari in vielen Hafenstädten und Marktorten als beliebte Reisekost etabliert. Ihre Herstellung wird jedoch fast ausschließlich von Glimmquali betrieben.',
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
