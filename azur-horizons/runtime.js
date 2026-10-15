// In Tasklet: local simulation. The separately launched server overrides this route.
window.AZ_RUNTIME={network:false};
const archiveLink=document.getElementById('event-download');
if(archiveLink&&location.protocol!=='file:'&&new URLSearchParams(location.search).get('download')==='1')archiveLink.hidden=false;
