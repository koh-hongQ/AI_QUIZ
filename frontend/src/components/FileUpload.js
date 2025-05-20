import React, { useState, useRef } from 'react';
import { 
  Box, 
  Button, 
  FormControl, 
  FormLabel, 
  Input, 
  Text, 
  Progress, 
  Flex, 
  useToast,
  Alert,
  AlertIcon,
  CloseButton,
  VStack,
  HStack,
  Icon,
  Badge,
  Center
} from '@chakra-ui/react';
import { AttachmentIcon, CheckCircleIcon } from '@chakra-ui/icons';
import { FiUpload, FiFile } from 'react-icons/fi';
import { uploadPdf, apiUtils } from '../api';

const FileUpload = ({ onUploadSuccess, onUploadError }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef();
  const toast = useToast();

  const validateFile = (file) => {
    if (!file) return 'Please select a file first';
    
    if (file.type !== 'application/pdf') {
      return 'Please upload a PDF file';
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      return 'File size exceeds the 10MB limit';
    }

    return null;
  };

  const handleFileChange = (file) => {
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      if (onUploadError) onUploadError(new Error(validationError));
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileChange(file);
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await uploadPdf(selectedFile, (progress) => {
        setUploadProgress(progress);
      });

      toast({
        title: 'File uploaded successfully',
        description: 'Your PDF is now being processed with AI',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Reset file input
      setSelectedFile(null);
      fileInputRef.current.value = null;
      
      // Call success callback with response data
      if (onUploadSuccess) {
        onUploadSuccess(response);
      }
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = apiUtils.formatErrorMessage(err);
      setError(errorMessage);
      
      toast({
        title: 'Upload failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });

      if (onUploadError) {
        onUploadError(err);
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Box borderWidth="2px" borderRadius="lg" borderColor={dragActive ? "blue.300" : "gray.200"} bg={dragActive ? "blue.50" : "white"}>
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <Box flex="1">
            {error}
          </Box>
          <CloseButton 
            position="absolute" 
            right="8px" 
            top="8px" 
            onClick={() => setError(null)} 
          />
        </Alert>
      )}

      <Box
        p={6}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <FormControl>
          <FormLabel htmlFor="upload-file">Upload PDF Lecture Material</FormLabel>
          <Input
            ref={fileInputRef}
            type="file"
            id="upload-file"
            accept="application/pdf"
            onChange={handleFileInputChange}
            hidden
          />
          
          {!selectedFile ? (
            <Center
              minH="200px"
              borderWidth="2px"
              borderRadius="md"
              borderStyle="dashed"
              borderColor={dragActive ? "blue.300" : "gray.300"}
              bg={dragActive ? "blue.50" : "gray.50"}
              cursor="pointer"
              onClick={() => fileInputRef.current.click()}
              _hover={{ borderColor: "blue.400", bg: "blue.50" }}
              transition="all 0.2s"
            >
              <VStack spacing={4}>
                <Icon as={FiUpload} boxSize={10} color="gray.400" />
                <VStack spacing={1}>
                  <Text fontWeight="semibold">
                    Drop your PDF here, or{' '}
                    <Text as="span" color="blue.500" textDecoration="underline">
                      browse
                    </Text>
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    Maximum file size: 10MB
                  </Text>
                </VStack>
              </VStack>
            </Center>
          ) : (
            <Box
              p={4}
              borderWidth="1px"
              borderRadius="md"
              borderColor="green.200"
              bg="green.50"
            >
              <HStack spacing={3}>
                <Icon as={FiFile} color="green.500" boxSize={5} />
                <VStack align="start" spacing={1} flex="1">
                  <Text fontWeight="semibold" color="green.700">
                    {selectedFile.name}
                  </Text>
                  <HStack spacing={2}>
                    <Badge colorScheme="green" size="sm">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </Badge>
                    <Badge colorScheme="blue" size="sm">
                      PDF
                    </Badge>
                  </HStack>
                </VStack>
                <Icon as={CheckCircleIcon} color="green.500" boxSize={5} />
              </HStack>
            </Box>
          )}

          {!selectedFile && (
            <Button
              leftIcon={<AttachmentIcon />}
              onClick={() => fileInputRef.current.click()}
              colorScheme="blue"
              variant="outline"
              mt={4}
              w="100%"
            >
              Browse Files
            </Button>
          )}
        </FormControl>

        {selectedFile && (
          <VStack spacing={4} mt={6}>
            <Button
              leftIcon={<FiUpload />}
              colorScheme="blue"
              isLoading={isUploading}
              loadingText="Uploading..."
              onClick={handleUpload}
              size="lg"
              isFullWidth
              disabled={!selectedFile}
            >
              Upload and Process with AI
            </Button>

            {isUploading && (
              <Box w="100%">
                <Flex justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.600">Uploading...</Text>
                  <Text fontSize="sm" color="gray.600">{uploadProgress}%</Text>
                </Flex>
                <Progress
                  value={uploadProgress}
                  size="lg"
                  colorScheme="blue"
                  hasStripe
                  isAnimated
                  borderRadius="md"
                />
              </Box>
            )}
          </VStack>
        )}
        
        {!selectedFile && (
          <Text fontSize="sm" color="gray.500" mt={4} textAlign="center">
            Supports text-based PDFs and scanned documents with OCR processing
          </Text>
        )}
      </Box>
    </Box>
  );
};

export default FileUpload;