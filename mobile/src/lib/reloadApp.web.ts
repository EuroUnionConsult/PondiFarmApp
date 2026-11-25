/** Web: recarrega a página. */
export async function reloadApp(): Promise<boolean> {
  window.location.reload();
  return true;
}
