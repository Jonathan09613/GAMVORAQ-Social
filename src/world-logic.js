// Regla de MEMORIES compartida por la vista y las pruebas: un recuerdo con menciones se comparte
// solo cuando TODAS las personas mencionadas aprobaron.
export const memoryApproved = (consents) => consents.length > 0 && consents.every(c => c.status === 'approved');
