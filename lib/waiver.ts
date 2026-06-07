import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase/client'

export interface WaiverSettings {
  text: string
  version: string // bumped each time the text is edited
  updatedAt: string
}

// Default waiver, derived from the paper card's terms. Fully editable by the
// owner in Admin → Settings; the signed snapshot always stores whatever text
// was shown at signing time.
export const DEFAULT_WAIVER = `RENTAL AGREEMENT & WAIVER / ACUERDO DE ALQUILER Y EXENCIÓN

1. Children MUST be supervised at all times when using the jumper.
   Los niños deben estar supervisados en todo momento cuando utilicen el saltador.

2. Renter assumes FULL responsibility for ANY loss or damage to the equipment and agrees to pay fair market value for such loss or damage.
   El arrendatario asume TODA la responsabilidad por CUALQUIER pérdida o daño al equipo y acepta pagar el valor justo de mercado.

3. Jumpers are delivered and picked up the same day — no overnights.
   Los saltadores se entregan y recogen el mismo día; no se admiten pernoctaciones.

4. The company is NOT responsible for any injuries.
   La empresa NO se hace responsable de ninguna lesión.

5. No food, beverages, or electronics inside the jumper.
6. Do not place hot items on chairs or tables.
7. Do not move the jumper.
8. Avoid stains on any rental items.
9. No refunds.
10. Not responsible for lost items.

By signing below, I confirm that I have read, understood, and agree to all the terms above.
Al firmar a continuación, confirmo que he leído, entendido y aceptado todos los términos anteriores.`

export async function getWaiver(): Promise<WaiverSettings> {
  const snap = await getDoc(doc(db, 'settings', 'waiver'))
  if (snap.exists()) return snap.data() as WaiverSettings
  return { text: DEFAULT_WAIVER, version: 'v1', updatedAt: '' }
}

export async function saveWaiver(text: string): Promise<void> {
  await setDoc(doc(db, 'settings', 'waiver'), {
    text,
    version: 'v' + Date.now(),
    updatedAt: new Date().toISOString(),
  })
}
