import "dotenv/config";
import { findArtist, getAllArtistNames, isHexId } from "./artist-registry";

const UPNSHARE_API_BASE = "https://upnshare.com/api/v1";
const API_TOKEN = process.env.UPNSHARE_API_TOKEN;
const MANUAL_REVIEW_FOLDER = "Needs Manual Review";

if (!API_TOKEN) {
  console.error("❌ UPNSHARE_API_TOKEN not found in environment");
  process.exit(1);
}

interface Video {
  id: string;
  title: string;
  folder_id: string;
}

interface Folder {
  id: string;
  name: string;
}

async function fetchWithAuth(url: string) {
  const response = await fetch(url, {
    headers: {
      "api-token": API_TOKEN!,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} ${error}`);
  }

  return response.json();
}

async function getAllFolders(): Promise<Folder[]> {
  const data = await fetchWithAuth(`${UPNSHARE_API_BASE}/video/folder`);
  return Array.isArray(data) ? data : data.data || [];
}

async function getAllVideosFromFolder(folderId: string): Promise<Video[]> {
  const url = `${UPNSHARE_API_BASE}/video/folder/${folderId}?page=1&perPage=1000`;
  const response = await fetchWithAuth(url);
  const videos = Array.isArray(response) ? response : response.data || [];
  
  return videos.map((v: any) => ({
    id: v.id,
    title: v.title || v.name || `Video ${v.id}`,
    folder_id: folderId,
  }));
}

async function createFolder(name: string): Promise<Folder> {
  const response = await fetch(`${UPNSHARE_API_BASE}/video/folder`, {
    method: "POST",
    headers: {
      "api-token": API_TOKEN!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create folder: ${error}`);
  }

  await new Promise(resolve => setTimeout(resolve, 200));
  return response.json();
}

async function deleteFolder(folderId: string): Promise<void> {
  await fetch(`${UPNSHARE_API_BASE}/video/folder/${folderId}`, {
    method: "DELETE",
    headers: {
      "api-token": API_TOKEN!,
    },
  });
  await new Promise(resolve => setTimeout(resolve, 200));
}

async function moveVideoToFolder(videoId: string, folderId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${UPNSHARE_API_BASE}/video/folder/${folderId}/link`,
      {
        method: "POST",
        headers: {
          "api-token": API_TOKEN!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId }),
      }
    );
    await new Promise(resolve => setTimeout(resolve, 100));
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log("🧹 Starting cleanup and organization...\n");

  // Step 1: Get all folders
  console.log("📂 Fetching all folders...");
  const allFolders = await getAllFolders();
  console.log(`  Found ${allFolders.length} folders\n`);

  // Step 2: Build the canonical folder map
  // For each artist, find ONE folder to be the canonical folder
  const artistFolderMap = new Map<string, string>(); // artist name -> folder ID
  const foldersToDelete: Folder[] = [];
  const validArtistNames = new Set(getAllArtistNames());
  validArtistNames.add(MANUAL_REVIEW_FOLDER);

  console.log("🔍 Analyzing folders...");
  for (const folder of allFolders) {
    const folderName = folder.name.trim();
    
    // Check if this is a valid artist folder or manual review
    if (validArtistNames.has(folderName)) {
      if (!artistFolderMap.has(folderName)) {
        // This is the first (canonical) folder for this artist
        artistFolderMap.set(folderName, folder.id);
        console.log(`  ✓ ${folderName} → folder ID: ${folder.id}`);
      } else {
        // This is a duplicate - mark for deletion
        foldersToDelete.push(folder);
        console.log(`  ⚠️  Duplicate "${folderName}" (will merge and delete)`);
      }
    } else if (isHexId(folderName) || folderName.match(/^[0-9a-f]{8}/i)) {
      // Hex ID folder - mark for deletion
      foldersToDelete.push(folder);
      console.log(`  ❌ Junk folder "${folderName}" (will delete)`);
    } else {
      // Unknown folder - mark for deletion
      foldersToDelete.push(folder);
      console.log(`  ⚠️  Unknown folder "${folderName}" (will delete)`);
    }
  }

  // Step 3: Ensure required folders exist
  console.log("\n📁 Ensuring required folders exist...");
  for (const artistName of getAllArtistNames()) {
    if (!artistFolderMap.has(artistName)) {
      console.log(`  Creating "${artistName}"...`);
      const newFolder = await createFolder(artistName);
      artistFolderMap.set(artistName, newFolder.id);
    }
  }

  if (!artistFolderMap.has(MANUAL_REVIEW_FOLDER)) {
    console.log(`  Creating "${MANUAL_REVIEW_FOLDER}"...`);
    const newFolder = await createFolder(MANUAL_REVIEW_FOLDER);
    artistFolderMap.set(MANUAL_REVIEW_FOLDER, newFolder.id);
  }

  // Step 4: Collect all videos
  console.log("\n🎬 Collecting all videos...");
  const allVideos: Video[] = [];
  for (const folder of allFolders) {
    const videos = await getAllVideosFromFolder(folder.id);
    allVideos.push(...videos);
    console.log(`  ✓ ${videos.length} videos from "${folder.name}"`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  console.log(`\n  Total: ${allVideos.length} videos\n`);

  // Step 5: Organize videos by artist
  console.log("🎯 Organizing videos by artist...");
  const videoMoves = new Map<string, Video[]>(); // target folder ID -> videos to move
  let unidentified = 0;

  for (const video of allVideos) {
    const artistName = findArtist(video.title);
    const targetFolderId = artistName 
      ? artistFolderMap.get(artistName)!
      : artistFolderMap.get(MANUAL_REVIEW_FOLDER)!;

    if (!videoMoves.has(targetFolderId)) {
      videoMoves.set(targetFolderId, []);
    }
    videoMoves.get(targetFolderId)!.push(video);

    if (!artistName) {
      unidentified++;
    }
  }

  // Display organization plan
  console.log("\n📊 Organization Plan:");
  for (const [folderId, videos] of videoMoves) {
    const folderName = Array.from(artistFolderMap.entries())
      .find(([_, id]) => id === folderId)?.[0] || "Unknown";
    console.log(`  ${folderName}: ${videos.length} videos`);
  }
  console.log(`  Unidentified: ${unidentified} videos → ${MANUAL_REVIEW_FOLDER}\n`);

  // Step 6: Move all videos
  console.log("📦 Moving videos to correct folders...");
  let movedCount = 0;
  let failedCount = 0;

  for (const [targetFolderId, videos] of videoMoves) {
    const folderName = Array.from(artistFolderMap.entries())
      .find(([_, id]) => id === targetFolderId)?.[0];
    
    for (const video of videos) {
      // Skip if already in correct folder
      if (video.folder_id === targetFolderId) {
        continue;
      }

      const success = await moveVideoToFolder(video.id, targetFolderId);
      if (success) {
        movedCount++;
      } else {
        failedCount++;
      }
    }
    console.log(`  ✓ Organized ${videos.length} videos into "${folderName}"`);
  }

  // Step 7: Delete junk and duplicate folders
  console.log("\n🗑️  Cleaning up folders...");
  for (const folder of foldersToDelete) {
    try {
      await deleteFolder(folder.id);
      console.log(`  ✓ Deleted "${folder.name}"`);
    } catch (error) {
      console.log(`  ✗ Failed to delete "${folder.name}"`);
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("✨ Cleanup and Organization Complete!\n");
  console.log("📊 Summary:");
  console.log(`  - Total videos: ${allVideos.length}`);
  console.log(`  - Videos moved: ${movedCount}`);
  console.log(`  - Videos failed: ${failedCount}`);
  console.log(`  - Folders deleted: ${foldersToDelete.length}`);
  console.log(`  - Active artist folders: ${getAllArtistNames().length}`);
  console.log(`  - Videos needing review: ${unidentified}`);
  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
