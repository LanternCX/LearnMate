// HTTP and model streams share the same account-switch generation.
export let activeUser = "";
export let sessionRevision = 0;

export function setActiveUser(id: string) {
  activeUser = id;
  sessionRevision++;
}
