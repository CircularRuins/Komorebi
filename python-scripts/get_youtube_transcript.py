#!/usr/bin/env python3
"""
YouTube Transcript Fetcher
Fetches transcript for a YouTube video using youtube-transcript-api
"""

import sys
import json
import argparse
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable


def get_transcript(video_id, languages=None):
    """
    Fetch transcript for a YouTube video
    
    Args:
        video_id: YouTube video ID
        languages: List of language codes (e.g., ['en', 'zh']). If None, tries to fetch any available transcript.
    
    Returns:
        List of transcript entries with 'text', 'start', and 'duration' keys
    """
    try:
        # Create API instance
        ytt_api = YouTubeTranscriptApi()
        
        # Fetch transcript
        # If languages are specified, pass them as a list
        if languages and len(languages) > 0:
            fetched_transcript = ytt_api.fetch(video_id, languages=languages)
        else:
            fetched_transcript = ytt_api.fetch(video_id)
        
        # Get raw data
        raw_data = fetched_transcript.to_raw_data()
        
        return raw_data
    
    except TranscriptsDisabled:
        raise Exception("Transcripts are disabled for this video")
    except NoTranscriptFound:
        raise Exception("No transcript found for this video")
    except VideoUnavailable:
        raise Exception("Video is unavailable")
    except Exception as e:
        # Re-raise if it's already our custom exception
        if "Transcripts are disabled" in str(e) or "No transcript found" in str(e) or "Video is unavailable" in str(e):
            raise
        raise Exception(f"Error fetching transcript: {str(e)}")


def main():
    parser = argparse.ArgumentParser(description='Fetch YouTube video transcript')
    parser.add_argument('video_id', help='YouTube video ID')
    parser.add_argument('--languages', nargs='+', help='Preferred language codes (e.g., en zh)', default=None)
    
    args = parser.parse_args()
    
    try:
        result = get_transcript(args.video_id, args.languages)
        # Output as JSON - result is a list of transcript entries
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        # Output error as JSON
        error_result = {"error": str(e)}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()

