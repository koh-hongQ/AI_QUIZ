import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  Container,
  Divider,
  Alert,
  AlertIcon,
  VStack,
  Button,
  Icon,
  Flex,
  useToast
} from '@chakra-ui/react';
import { FiInfo, FiFileText, FiCpu } from 'react-icons/fi';
import FileUpload from '../components/FileUpload';
import ProcessingStatus from '../components/ProcessingStatus';
import { checkApiHealth } from '../api';

const UploadPage = () => {
  const [uploadedDocument, setUploadedDocument] = useState(null);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleUploadSuccess = (data) => {
    console.log('Upload success:', data);
    setUploadedDocument(data);
    
    toast({
      title: 'Upload Successful',
      description: `PDF uploaded successfully. Processing has started.`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleUploadError = (error) => {
    toast({
      title: 'Upload Failed',
      description: error.message || 'Failed to upload PDF. Please try again.',
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  };

  const handleProcessingComplete = (data) => {
    console.log('Processing complete:', data);
    
    toast({
      title: 'Processing Complete',
      description: 'Your document is ready for quiz generation!',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    
    // Navigate to quiz generation page
    navigate(`/generate/${uploadedDocument.documentId}`);
  };

  const handleHealthCheck = async () => {
    setIsHealthChecking(true);
    try {
      const health = await checkApiHealth();
      toast({
        title: 'Backend Status',
        description: health.message || 'Backend is running normally',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Backend Check Failed',
        description: 'Could not connect to backend service. Please ensure the server is running.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsHealthChecking(false);
    }
  };

  return (
    <Container maxW="container.md">
      <VStack spacing={6}>
        <Box textAlign="center">
          <Heading as="h1" size="xl" color="blue.600">
            Upload PDF Lecture Material
          </Heading>
          <Text mt={3} color="gray.600" fontSize="lg">
            Upload your PDF document to generate quizzes from its content using AI
          </Text>
        </Box>

        {/* Features Info */}
        <Box bg="gray.50" p={6} borderRadius="lg" w="100%">
          <Heading size="md" mb={4} color="gray.700">
            <Icon as={FiInfo} mr={2} />
            Enhanced AI Features
          </Heading>
          <VStack align="start" spacing={3}>
            <Flex align="center">
              <Icon as={FiFileText} color="blue.500" mr={3} />
              <Text>Advanced PDF processing with OCR support for scanned documents</Text>
            </Flex>
            <Flex align="center">
              <Icon as={FiCpu} color="green.500" mr={3} />
              <Text>AI-powered text cleaning and intelligent content chunking</Text>
            </Flex>
            <Flex align="center">
              <Icon as={FiCpu} color="purple.500" mr={3} />
              <Text>Semantic search using e5-small embeddings for better quiz generation</Text>
            </Flex>
          </VStack>
        </Box>

        <Alert status="info" borderRadius="md">
          <AlertIcon />
          For best results, ensure your PDF has clear, readable text content. 
          We support both text-based PDFs and scanned documents with OCR capabilities.
        </Alert>

        {/* Health Check Button */}
        <Button 
          onClick={handleHealthCheck} 
          isLoading={isHealthChecking}
          loadingText="Checking..."
          variant="outline"
          size="sm"
          colorScheme="gray"
        >
          Check Backend Status
        </Button>

        <FileUpload 
          onUploadSuccess={handleUploadSuccess} 
          onUploadError={handleUploadError}
        />

        {uploadedDocument && (
          <>
            <Divider />
            <Box w="100%">
              <ProcessingStatus 
                documentId={uploadedDocument.documentId} 
                onProcessingComplete={handleProcessingComplete}
                filename={uploadedDocument.filename}
              />
            </Box>
          </>
        )}
      </VStack>
    </Container>
  );
};

export default UploadPage;