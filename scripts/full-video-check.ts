import "dotenv/config";

const API_TOKEN = process.env.UPNSHARE_API_TOKEN;
const UPNSHARE_API_BASE = "https://upnshare.com/api/v1";

async function fetchWithAuth(url: string) {
  const response = await fetch(url, {
    headers: { 'api-token': API_TOKEN! }
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

async function main() {
  console.log("Checking all folders and videos...\n");
  
  // Get all folders
  const foldersData = await fetchWithAuth(`${UPNSHARE_API_BASE}/video/folder`);
  const folders = Array.isArray(foldersData) ? foldersData : foldersData.data || [];
  
  console.log(`Found ${folders.length} folders\n`);
  
  let totalVideos = 0;
  const videoDetails: any[] = [];
  
  // Check each folder
  for (const folder of folders) {
    try {
      const url = `${UPNSHARE_API_BASE}/video/folder/${folder.id}?page=1&perPage=1000`;
      const response = await fetchWithAuth(url);
      const videos = Array.isArray(response) ? response : response.data || [];
      
      if (videos.length > 0) {
        console.log(`Folder "${folder.name}" (${folder.id}):`);
        console.log(`  Found ${videos.length} videos`);
        for (const video of videos) {
          console.log(`    - ${video.title || video.name || video.id}`);
          videoDetails.push({
            folder: folder.name,
            title: video.title || video.name,
            id: video.id
          });
        }
        totalVideos += videos.length;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`  Error checking folder ${folder.name}:`, error);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log(`TOTAL VIDEOS FOUND: ${totalVideos}`);
  console.log("=".repeat(60));
  
  if (totalVideos === 0) {
    console.log("\n⚠️  WARNING: No videos found in any folder");
    console.log("The videos may have been deleted when folders were removed.");
  }
}

main().catch(console.error);
