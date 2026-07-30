import { recoverMessageAddress } from 'viem'
import { SIGNATURE_RE } from './complaints.ts'

// Isolé de lib/complaints.ts pour que le noyau métier reste testable sans viem
// et sans crypto de courbe. Ici, une seule responsabilité : reconstruire
// l'adresse qui a signé une chaîne UTF-8 en personal_sign (EIP-191).
//
// Limite connue et assumée : un portefeuille à contrat (ERC-1271) ne peut pas
// signer ainsi. Les payeurs x402 signent en EIP-3009, donc sont des comptes
// externes ; une contrepartie qui n'est joignable que par contrat est traitée à
// la main. C'est écrit sur la page publique plutôt que masqué.

/** Renvoie l'adresse signataire en minuscules, ou null si la signature est invalide. */
export async function recoverStatementSigner(
  statement: string,
  signature: string,
): Promise<string | null> {
  if (!SIGNATURE_RE.test(signature)) return null
  try {
    const address = await recoverMessageAddress({
      message: statement,
      signature: signature as `0x${string}`,
    })
    return address.toLowerCase()
  } catch {
    return null
  }
}
